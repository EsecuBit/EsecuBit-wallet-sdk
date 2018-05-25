
const D = require('../../D').class

const TYPE_ADDRESS = 'address'
const TYPE_TRANSACTION_INFO = 'transaction_info'
// TODO check block height to restart request
let ADDRESS_REQUEST_PERIOD = 600 // seconds per request
let TRANSACTION_REQUEST_PERIOD = 60 // seconds per request

if (D.TEST_MODE) {
  ADDRESS_REQUEST_PERIOD = 5 // seconds per request
  TRANSACTION_REQUEST_PERIOD = 5 // seconds per request
}

const ICoinNetwork = function () {
  this._startQueue = false
  this.coinType = 'undefined'
  this._blockHeight = -1
  this._supportMultiAddresses = false
  this._requestRate = 2 // seconds per request
  this._requestList = []

  this._queue = () => {
    const timeStamp = new Date().getTime()
    console.log(timeStamp)
    for (let request of this._requestList) {
      console.warn('compare', request.nextTime, timeStamp)
      if (request.nextTime <= timeStamp) {
        request.request()
        break
      }
    }
    if (this._startQueue) {
      setTimeout(this._queue, this._requestRate * 1000)
    }
  }
}
module.exports = {class: ICoinNetwork}

ICoinNetwork.prototype.provider = 'undefined'
ICoinNetwork.prototype.website = 'undefined'

ICoinNetwork.prototype.get = function (url) {
  return new Promise((resolve, reject) => {
    let xmlhttp = new XMLHttpRequest()
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          try {
            resolve(JSON.parse(xmlhttp.responseText))
          } catch (e) {
            resolve({response: xmlhttp.responseText})
          }
        } else if (xmlhttp.status === 500) {
          console.warn(url, xmlhttp)
          reject(D.ERROR_NETWORK_PROVIDER_ERROR)
        } else {
          console.warn(url, xmlhttp)
          reject(D.ERROR_NETWORK_UNVAILABLE)
        }
      }
    }
    xmlhttp.open('GET', url, true)
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
    xmlhttp.send()
  })
}

ICoinNetwork.prototype.post = function (url, args) {
  return new Promise((resolve, reject) => {
    const xmlhttp = new XMLHttpRequest()
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          try {
            resolve(JSON.parse(xmlhttp.responseText))
          } catch (e) {
            resolve({response: xmlhttp.responseText})
          }
        } else if (xmlhttp.status === 500) {
          console.warn(url, xmlhttp)
          reject(D.ERROR_NETWORK_PROVIDER_ERROR)
        } else {
          console.warn(url, xmlhttp)
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
ICoinNetwork.prototype.listenTx = function (txInfo, callback) {
  const that = this
  this._requestList.push({
    type: TYPE_TRANSACTION_INFO,
    txInfo: txInfo,
    nextTime: new Date().getTime(),
    request: async () => {
      let remove = function remove (arr, val) {
        let index = arr.indexOf(val)
        if (index > -1) {
          arr.splice(index, 1)
        }
      }
      try {
        let response = that.queryTransaction(this.txInfo.txId)
        this.txInfo.confirmations = response.confirmations
        if (response.confirmations >= D.TX_BTC_MATURE_CONFIRMATIONS) {
          console.info('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        callback(D.ERROR_NO_ERROR, this.txInfo)
      } catch (e) {
        callback(e)
      }
      this.nextTime = new Date().getTime() + TRANSACTION_REQUEST_PERIOD * 1000
    }
  })
}

/**
 * listen new transaction from specific address
 */
ICoinNetwork.prototype.listenAddresses = function (addressInfos, callback) {
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
      request: async () => {
        let addresses = Object.keys(addressMap)
        try {
          let multiResponses = await that.queryAddresses(addresses)
          for (let response of multiResponses) {
            let addressInfo = addressMap[response.address]
            checkNewTx(response, addressInfo)
          }
          this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
        } catch (e) {
          callback(e)
        }
      }
    })
  } else {
    for (let addressInfo of addressInfos) {
      this._requestList.push({
        type: TYPE_ADDRESS,
        addressInfo: addressInfo,
        nextTime: new Date().getTime(),
        request: async () => {
          try {
            let response = await that.queryAddress(this.addressInfo.address)
            checkNewTx(response, this.addressInfo)
            this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
          } catch (e) {
            callback(e)
          }
        }
      })
    }
  }

  function checkNewTx (response, addressInfo) {
    for (let tx of response) {
      if (addressInfo.txs.some(aTx => aTx.txId === tx.txId)) {
        if (!tx.hasDetails) {
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

    function newTransaction (addressInfo, tx) {
      addressInfo.txs.push(tx.txId)
      let output = tx.outputs.find(output => addressInfo.address === output.address)
      let direction = output ? D.TX_DIRECTION_IN : D.TX_DIRECTION_OUT
      let txInfo = {
        accountId: addressInfo.accountId,
        coinType: addressInfo.coinType,
        txId: tx.txId,
        version: tx.version,
        blockNumber: tx.blockNumber,
        confirmations: tx.confirmations,
        lockTime: tx.lockTime,
        time: tx.time,
        direction: direction,
        value: tx.value
      }
      if (direction === D.TX_DIRECTION_IN) {
        let utxo = {
          accountId: addressInfo.accountId,
          coinType: addressInfo.coinType,
          address: addressInfo.addressInfo,
          path: addressInfo.path,
          txId: tx.txId,
          index: output.index,
          script: output.script,
          value: output.value
        }
        callback(D.ERROR_NO_ERROR, addressInfo, txInfo, utxo)
      } else {
        callback(D.ERROR_NO_ERROR, addressInfo, txInfo)
      }
    }
  }
}

ICoinNetwork.prototype.init = async function (coinType) {
  this._startQueue = true
  // start the request loop
  setTimeout(this._queue, this._requestRate * 1000)
  return {}
}

ICoinNetwork.prototype.release = async function () {
  this._startQueue = false
  this._requestList = []
}

/**
 * @return addressInfo array
 * @see addressInfo
 */
ICoinNetwork.prototype.queryAddresses = async function (addresses) {
  throw D.ERROR_NOT_IMPLEMENTED
}

/**
 * @return addressInfo:
 * {
 *    address: string,
 *    txCount: int,
 *    txs: tx array
 * }
 *
 * @see queryTransaction
 *
 */
ICoinNetwork.prototype.queryAddress = async function (address) {
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
 *    intputs: [{prevAddress, value(bitcoin -> santoshi)}],
 *    outputs: [{address, value(bitcoin -> santoshi)}, index, script]
 * }
 *
 */
ICoinNetwork.prototype.queryTransaction = async function (txId) {
  throw D.ERROR_NOT_IMPLEMENTED
}

ICoinNetwork.prototype.sendTrnasaction = async function (rawTransaction) {
  throw D.ERROR_NOT_IMPLEMENTED
}
