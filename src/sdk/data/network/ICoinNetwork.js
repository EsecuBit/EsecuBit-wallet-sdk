
import D from '../../D'

const TYPE_ADDRESS = 'address'
const TYPE_TRANSACTION_INFO = 'transaction_info'
// TODO check block height to restart request
let ADDRESS_REQUEST_PERIOD = 600 // seconds per request
let TRANSACTION_REQUEST_PERIOD = 60 // seconds per request

if (D.TEST_NETWORK_REQUEST) {
  ADDRESS_REQUEST_PERIOD = 10 // seconds per request
  TRANSACTION_REQUEST_PERIOD = 10 // seconds per request
}

export default class ICoinNetwork {
  constructor () {
    this._startQueue = false
    this._blockHeight = -1
    this._supportMultiAddresses = false
    this._requestRate = 2 // seconds per request
    this._requestList = []
  }

  get (url) {
    return new Promise((resolve, reject) => {
      console.log('get', url)
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

  post (url, args) {
    console.log('post', url, args)
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
  listenTx (txInfo, callback) {
    const that = this
    let remove = (arr, val) => {
      let index = arr.indexOf(val)
      if (index > -1) {
        arr.splice(index, 1)
      }
    }
    this._requestList.push({
      type: TYPE_TRANSACTION_INFO,
      txInfo: txInfo,
      nextTime: 0,
      request: async function () {
        this.nextTime = new Date().getTime() + TRANSACTION_REQUEST_PERIOD * 1000
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
      }
    })
  }

  /**
   * listen new transaction from specific address
   */
  listenAddresses (addressInfos, callback, oneTime = false) {
    let remove = (arr, val) => {
      let index = arr.indexOf(val)
      if (index > -1) {
        arr.splice(index, 1)
      }
    }

    let checkNewTx = (response, addressInfo) => {
      let newTransaction = (addressInfo, tx) => {
        console.log('newTransaction', addressInfo, tx)
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
          inputs: tx.inputs.map(input => {
            return {prevAddress: input.prevAddress, value: input.value}
          }),
          outputs: tx.outputs.map(output => {
            return {address: output.address, value: output.value}
          })
        }
        if (direction === D.TX_DIRECTION_IN) {
          let utxo = {
            accountId: addressInfo.accountId,
            coinType: addressInfo.coinType,
            address: addressInfo.address,
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

      let newTxs = response.txs.filter(tx => !addressInfo.txs.some(aTx => aTx.txId === tx.txId))
      // noinspection JSCheckFunctionSignatures
      newTxs.filter(tx => tx.hasDetails).forEach(tx => newTransaction(addressInfo, tx))
      newTxs.filter(tx => !tx.hasDetails).forEach(
        tx => that._network[addressInfo.coinType].queryTransaction(tx.txId)
          .then(tx => newTransaction(addressInfo, tx))
          .catch(callback))
    }

    const that = this
    if (this._supportMultiAddresses) {
      let addressMap = {}
      addressInfos.forEach(addressInfo => {
        addressMap[addressInfo.address] = addressInfo
      })
      this._requestList.push({
        type: TYPE_ADDRESS,
        addressMap: addressMap,
        oneTime: oneTime,
        nextTime: 0,
        request: function () {
          this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
          let addresses = Object.keys(addressMap)
          that.queryAddresses(addresses)
            .then(multiResponses => {
              multiResponses.forEach(response => checkNewTx(response, addressMap[response.address]))
              oneTime && remove(that._requestList, this)
            })
            // TODO retry
            // TODO callback error once
            .catch(callback)
        }
      })
    } else {
      for (let addressInfo of addressInfos) {
        this._requestList.push({
          type: TYPE_ADDRESS,
          addressInfo: addressInfo,
          nextTime: 0,
          request: async function () {
            this.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000
            that.queryAddress(this.addressInfo.address)
              .then(response => {
                checkNewTx(response, this.addressInfo)
                oneTime && remove(that._requestList, this)
              })
              .catch(callback)
          }
        })
      }
    }
  }

  async init () {
    this._startQueue = true
    // start the request loop
    let queue = () => {
      const timeStamp = new Date().getTime()
      for (let request of this._requestList) {
        if (!request) {
          // TODO one time
          console.warn('a removed request')
        }
        if (request.nextTime <= timeStamp) {
          request.request()
          break
        }
      }
      if (this._startQueue) {
        setTimeout(queue, this._requestRate * 1000)
      }
    }
    setTimeout(queue, 0)
    return {}
  }

  async release () {
    this._startQueue = false
    this._requestList = []
  }

  /**
   * @return addressInfo array
   * @see addressInfo
   */
  async queryAddresses (addresses) {
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
  async queryAddress (address) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  /**
   *
   * @return tx
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
  async queryTransaction (txId) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async sendTrnasaction (rawTx) {
    throw D.ERROR_NOT_IMPLEMENTED
  }
}
ICoinNetwork.provider = 'undefined'
