
const D = require('../../def').class

const TYPE_ADDRESS = 'address'
const TYPE_TRANSACTION_INFO = 'transaction_info'
// TODO check block height to restart request
let ADDRESS_REQUEST_PERIOD = 600 // seconds per request
let TRANSACTION_REQUEST_PERIOD = 600 // seconds per request

if (D.TEST_MODE) {
  ADDRESS_REQUEST_PERIOD = 5 // seconds per request
  TRANSACTION_REQUEST_PERIOD = 5 // seconds per request
}

const CoinNetwork = function () {
  this.startQueue = false
  this.coinType = 'undefined'
  this._blockHeight = -1
  this._supportMultiAddresses = false
  this._requestRate = 2 // seconds per request
  this._requestList = []

  this._queue = () => {
    const timeStamp = new Date().getTime()
    for (let request of this._requestList) {
      console.warn('compare', request.nextTime, timeStamp)
      if (request.nextTime <= timeStamp) {
        request.request()
        break
      }
    }
    if (this.startQueue) {
      setTimeout(this._queue, this._requestRate * 1000)
    }
  }
}
module.exports = {class: CoinNetwork}

CoinNetwork.prototype.provider = 'undefined'
CoinNetwork.prototype.website = 'undefined'

CoinNetwork.prototype.get = function (url) {
  return new Promise((resolve, reject) => {
    let xmlhttp = new XMLHttpRequest()
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          try {
            resolve(JSON.parse(xmlhttp.responseText))
          } catch (e) {
            console.warn(e)
            reject(D.ERROR_NETWORK_PROVIDER_ERROR)
          }
        } else if (xmlhttp.status === 500) {
          console.warn(url, xmlhttp.status)
          reject(D.ERROR_NETWORK_PROVIDER_ERROR)
        } else {
          console.warn(url, xmlhttp.status)
          reject(D.ERROR_NETWORK_UNVAILABLE)
        }
      }
    }
    xmlhttp.open('GET', url, true)
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
    xmlhttp.send()
  })
}

CoinNetwork.prototype.post = function (url, args) {
  return new Promise((resolve, reject) => {
    const xmlhttp = new XMLHttpRequest()
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          try {
            resolve(JSON.parse(xmlhttp.responseText))
          } catch (e) {
            console.warn(e)
            reject(D.ERROR_NETWORK_PROVIDER_ERROR)
          }
        } else if (xmlhttp.status === 500) {
          console.warn(url, xmlhttp.status)
          reject(D.ERROR_NETWORK_PROVIDER_ERROR)
        } else {
          console.warn(url, xmlhttp.status)
          reject(D.ERROR_NETWORK_UNVAILABLE)
        }
      }
    }
    xmlhttp.open('POST', url, true)
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
    xmlhttp.send(args)
  })
}

/**
 * listen transaction confirm status
 */
CoinNetwork.prototype.listenTransaction = function (transactionInfo, callback) {
  const that = this
  this._requestList.push({
    type: TYPE_TRANSACTION_INFO,
    transactionInfo: transactionInfo,
    nextTime: new Date().getTime(),
    request: () => {
      let remove = function remove (arr, val) {
        let index = arr.indexOf(val)
        if (index > -1) {
          arr.splice(index, 1)
        }
      }

      that.queryTransaction(this.transactionInfo.txId, (error, response) => {
        if (error !== D.ERROR_NO_ERROR) {
          callback(error)
          return
        }
        this.transactionInfo.confirmations = response.confirmations
        if (response.confirmations >= D.TRANSACTION_BTC_MATURE_CONFIRMATIONS) {
          console.info('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        callback(error, this.transactionInfo)
      })
      this.nextTime = new Date().getTime() + TRANSACTION_REQUEST_PERIOD * 1000
    }
  })
}

/**
 * listen new transaction from specific address
 */
CoinNetwork.prototype.listenAddresses = function (addressInfos, callback) {
  const that = this
  if (this._supportMultiAddresses) {
    let addressMap = {}
    for (let addressInfo of addressInfos) {
      addressMap[addressInfo.address] = addressInfo
    }
    this._requestList.push({
      type: TYPE_ADDRESS,
      addressMap: addressMap,
      nextTime: new Date().getTime(),
      request: function () {
        let addresses = Object.keys(addressMap)
        that.queryAddresses(addresses, function (error, multiResponses) {
          if (error !== D.ERROR_NO_ERROR) {
            callback(error)
            return
          }
          for (let response of multiResponses) {
            let addressInfo = addressMap[response.address]
            checkNewTx(response, addressInfo)
          }
          this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
        })
      }
    })
  } else {
    for (let addressInfo of addressInfos) {
      this._requestList.push({
        type: TYPE_ADDRESS,
        addressInfo: addressInfo,
        nextTime: new Date().getTime(),
        request: () => {
          that.queryAddress(this.addressInfo.address, (error, response) => {
            if (error !== D.ERROR_NO_ERROR) {
              callback(error)
              return
            }
            checkNewTx(response, this.addressInfo)
            this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
          })
        }
      })
    }
  }

  function checkNewTx (response, addressInfo) {
    for (let tx of response) {
      if (!hasTxId(addressInfo.txs, tx.txId)) {
        if (tx.hasDetails) {
          that._network[addressInfo.coinType].queryTransaction(tx.txId, function (error, response) {
            if (error !== D.ERROR_NO_ERROR) {
              callback(error)
              return
            }
            newTransaction(addressInfo, response)
          })
        } else {
          newTransaction(addressInfo, tx)
        }
      }
    }

    function hasTxId (txs, txId) {
      for (let tx of txs) {
        if (tx.txId === txId) {
          return true
        }
      }
      return false
    }

    function newTransaction (addressInfo, tx) {
      addressInfo.txs.push(tx.txId)
      let transactionInfo = {
        accountId: addressInfo.accountId,
        coinType: addressInfo.coinType,
        txId: tx.txId,
        confirmations: tx.confirmations,
        time: tx.time,
        direction: D.TRANSACTION_DIRECTION_IN,
        value: tx.value
      }
      callback(D.ERROR_NO_ERROR, addressInfo, transactionInfo)
    }
  }
}

CoinNetwork.prototype.init = async function (coinType) {
  this.startQueue = true
  // start the request loop
  setTimeout(this._queue, this._requestRate * 1000)
  await D.wait(0)
  return {}
}

CoinNetwork.prototype.release = function () {
  this.startQueue = false
  this._requestList = []
}

/**
 * @return addressInfo array
 * @see addressInfo
 */
CoinNetwork.prototype.queryAddresses = async function (addresses) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}
/**
 * @return addressInfo:
 * {
 *    address: string,
 *    balance: int,
 *    txCount: int,
 *    txs: tx array
 * }
 *
 * @see queryTransaction
 *
 */
CoinNetwork.prototype.queryAddress = async function (address) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

/**
 *
 * @return tx:
 * {
 *    txId: string,
 *    version: int,
 *    blockNumber: int,
 *    confirmations: int,
 *    lockTime: long
 *    time: long,
 *    hasDetails: bool,   // for queryAddress only, whether the tx has inputs and outputs. e.g. blockchain.info -> true, chain.so -> false
 *    intputs: [{address, value(bitcoin -> santoshi)}],
 *    outputs: [{address, value(bitcoin -> santoshi)}, index, script]
 * }
 *
 */
CoinNetwork.prototype.queryTransaction = async function (txId) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

CoinNetwork.prototype.sendTrnasaction = async function (rawTransaction) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}
