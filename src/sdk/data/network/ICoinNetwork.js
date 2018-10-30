
import D from '../../D'

const typeAddress = 'address'
const typeTx = 'tx'
const typeDetail = 'detail'

const txNotFoundMaxSeconds = 30

const remove = (arr, val) => {
  let index = arr.indexOf(val)
  if (index > -1) {
    arr.splice(index, 1)
  }
}

export default class ICoinNetwork {
  constructor (coinType) {
    this.coinType = coinType
    this._startQueue = false
    this._blockHeight = -1
    this._supportMultiAddresses = false
    this._requestRate = 5 // request per seconds
    this._requestList = []
  }

  async init () {
    // start the request loop
    this._startQueue = true
    let {txIncludedRequestPeriod} = this.getRequestPeroid()
    let queue = () => {
      for (let request of this._requestList) {
        if (request.type === typeTx && new Date().getTime() > request.nextTime) {
          request.nextTime = new Date().getTime() + txIncludedRequestPeriod * 1000
          request.request()
        } else if (request.currentBlock < this._blockHeight) {
          request.currentBlock = this._blockHeight
          request.request()
          break
        } else if (request.type === typeDetail) {
          request.request()
          remove(this._requestList, request)
          break
        }
      }
      if (this._startQueue) {
        setTimeout(queue, 1 / this._requestRate * 1000)
      }
    }
    setTimeout(queue, 0)

    // start the blockHeight loop
    let {blockHeightRequestPeriod} = this.getRequestPeroid()
    let blockHeightRequest = async () => {
      let newBlockHeight = await this.getBlockHeight()
      if (newBlockHeight !== this._blockHeight) {
        this._blockHeight = newBlockHeight
        console.debug(this.coinType + ' has new block height ' + this._blockHeight)
      }
      setTimeout(blockHeightRequest, blockHeightRequestPeriod * 1000)
    }
    setTimeout(blockHeightRequest, 0)
  }

  // noinspection JSUnusedGlobalSymbols
  async release () {
    this._startQueue = false
    this._requestList = []
  }

  get (url) {
    return new Promise((resolve, reject) => {
      console.debug('get', url)
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
            reject(D.error.networkProviderError)
          } else {
            console.warn(url, xmlhttp)
            reject(D.error.networkUnavailable)
          }
        }
      }
      xmlhttp.open('GET', url, true)
      xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
      xmlhttp.send()
    })
  }

  post (url, args) {
    console.debug('post', url, args)
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
            reject(D.error.networkProviderError)
          } else {
            console.warn(url, xmlhttp)
            reject(D.error.networkUnavailable)
          }
        }
      }
      xmlhttp.open('POST', url, true)
      xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
      xmlhttp.send(args)
    })
  }

  /**
   * returns the network request speed. unit: seconds per request
   * blockHeightRequestPeriod: the peroid of detecting new block
   * txIncludedRequestPeriod: the peroid of detecting whether transaction is in memory pool
   * @returns {{blockHeightRequestPeriod: number, txIncludedRequestPeriod: number}}
   */
  getRequestPeroid () {
    let blockHeightRequestPeriod
    let txIncludedRequestPeriod
    if (D.isBtc(this.coinType)) {
      blockHeightRequestPeriod = 60
      txIncludedRequestPeriod = 30
    } else if (D.isEth(this.coinType)) {
      blockHeightRequestPeriod = 20
      txIncludedRequestPeriod = 5
    } else if (D.isEos(this.coinType)) {
      blockHeightRequestPeriod = 20
      txIncludedRequestPeriod = 5
    } else {
      console.warn('getRequestPeroid no match coin period')
      throw D.error.coinNotSupported
    }
    return {blockHeightRequestPeriod, txIncludedRequestPeriod}
  }

  /**
   * listen transaction confirm status
   */
  listenTx (txInfo, callback) {
    const that = this
    this._requestList.push({
      callback: callback,
      type: typeTx,
      txInfo: txInfo,
      hasRecord: false,
      currentBlock: -1,
      nextTime: 0,
      request: async function () {
        let response = {}
        try {
          if (!this.hasRecord) {
            response = await that.queryTx(this.txInfo.txId)
          }
        } catch (e) {
          if (e === D.error.networkTxNotFound) {
            if (txInfo.blockNumber >= 0) {
              txInfo.blockNumber === 0 && console.warn('tx dropped by network peer from memory pool')
              txInfo.blockNumber > 0 && console.warn('tx became orphan')
              this.txInfo.confirmations = D.tx.confirmation.dropped
              remove(that._requestList, this)
              callback(D.error.succeed, D.copy(this.txInfo), true)
            }

            let currentTime = new Date().getTime()
            let deltaSeconds = (currentTime - this.txInfo.time) / 1000
            if (deltaSeconds > txNotFoundMaxSeconds) {
              console.warn('tx not found in network for', deltaSeconds, 'seconds, stop wait for it. id: ', this.txInfo.txId)
              this.txInfo.confirmations = D.tx.confirmation.dropped
              remove(that._requestList, this)
              callback(D.error.succeed, D.copy(this.txInfo), true)
              return
            }

            console.log('tx not found in network for', deltaSeconds, 'seconds, continue. id: ', this.txInfo.txId)
            return
          }
          callback(e, D.copy(this.txInfo))
          return
        }
        let blockNumber = response.blockNumber ? response.blockNumber : this.txInfo.blockNumber
        let confirmations = blockNumber > 0 ? (that._blockHeight - blockNumber + 1) : 0

        if (confirmations > 0) {
          this.hasRecord = true
        }
        if (confirmations >= D.tx.getMatureConfirms(this.txInfo.coinType)) {
          console.log('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        if (confirmations > this.txInfo.confirmations) {
          this.txInfo.blockNumber = blockNumber
          this.txInfo.confirmations = confirmations
          callback(D.error.succeed, D.copy(this.txInfo))
        }
      }
    })
  }

  removeListener (callback) {
    this._requestList = this._requestList.filter(request => request.callback !== callback)
  }

  /**
   * listen new transaction for provided addresses on new block generated
   */
  listenAddresses (addressInfos, callback) {
    let tasks = this.generateAddressTasks(addressInfos)
    tasks.forEach(task => {
      this._requestList.push({
        callback: callback,
        type: typeAddress,
        currentBlock: -1,
        request: async () => {
          task.request()
            .then(blobs => blobs.forEach(
              blob => callback(D.error.succeed, blob.addressInfo, blob.txInfo, blob.removedTxId)))
            .catch(e => callback(e))
        }
      })
    })
  }

  /**
   * get all the new transactions provided addresseses immediately
   */
  async checkAddresses (addressInfos) {
    if (!addressInfos || addressInfos.length === 0) return []
    return Promise.all(this.generateAddressTasks(addressInfos).map(task => task.request()))
      .then(blobs => blobs.reduce((array, item) => array.concat(item), []))
  }

  generateAddressTasks (addressInfos) {
    let checkTx = async (response, addressInfo) => {
      let newTransaction = async (addressInfo, tx) => {
        let txInfo = tx
        txInfo.accountId = addressInfo.accountId
        txInfo.coinType = addressInfo.coinType
        return {addressInfo, txInfo}
      }

      let newTxs = response.txs.filter(tx => !addressInfo.txs.some(txId => txId === tx.txId))
      newTxs.forEach(tx => addressInfo.txs.push(tx.txId))
      let newTxBlobs = await Promise.all(newTxs.map(async tx => {
        // TODO later queryTx request speed for no details
        if (!tx.hasDetails) {
          console.debug('tx is not completed, get it in queue', tx)
          const getDetailsTask = (txId) => {
            let that = this
            return new Promise((resolve, reject) => {
              that._requestList.push({
                type: typeDetail,
                request: function () {
                  that.queryTx(txId).then(resolve).catch(reject)
                }
              })
            })
          }
          tx = await getDetailsTask(tx.txId)
        }
        return newTransaction(addressInfo, tx)
      }))

      let removedTxIds = addressInfo.txs.filter(txId => !response.txs.some(tx => txId === tx.txId))
      addressInfo.txs = addressInfo.txs.filter(txId => !removedTxIds.some(id => txId === id))
      let removedTxBlobs = removedTxIds.map(txId => {
        return {
          addressInfo: addressInfo,
          removedTxId: txId
        }
      })

      if (newTxBlobs.length || removedTxBlobs.length) {
        console.debug('ICoinNetwork checkTx', newTxBlobs, removedTxBlobs)
      }
      return newTxBlobs.concat(removedTxBlobs)
    }

    const _this = this
    if (this._supportMultiAddresses) {
      let addressMap = {}
      addressInfos.forEach(addressInfo => { addressMap[addressInfo.address] = addressInfo })
      let addresses = Object.keys(addressMap)
      return [{request () {
        return _this.queryAddresses(addresses)
          .then(multiResponses => Promise.all(multiResponses.map(response => checkTx(response, addressMap[response.address]))))
          .then(blobs => blobs.reduce((array, item) => array.concat(item), []))
      }}]
    } else {
      return addressInfos.map(addressInfo => {
        return {request () {
          return _this.queryAddress(addressInfo.address).then(response => checkTx(response, addressInfo))
        }}
      })
    }
  }

  getTxLink (txInfo) {
    throw D.error.notImplemented
  }

  async queryAddresses (addresses, offset = 0) {
    throw D.error.notImplemented
  }

  async queryAddress (address, offset = 0) {
    throw D.error.notImplemented
  }

  /**
   *
   * @return tx
   * btc:
   * {
   *    txId: string,
   *    version: int,
   *    blockNumber: int,
   *    confirmations: int,
   *    time: long,         // mills
   *    hasDetails: bool,   // for queryAddress only, whether the tx has inputs and outputs. e.g. blockchain.info -> true, chain.so -> false
   *    intputs: [{prevAddress, value(satoshi)}],
   *    outputs: [{address, value(satoshi)}, index, script]
   * }
   * eth:
   * {
   *    txId: string,
   *    blockNumber: int,
   *    confirmations: int,
   *    time: long,
   *    hasDetails: bool,
   *    intputs: [{prevAddress, value(wei)}], // tx.from, always length = 1
   *    outputs: [{address, value(wei)}], // tx.to, always length = 1
   *    gas: string, // decimal wei
   *    gasPrice: string // decimal wei
   * }
   *
   */
  async queryTx (txId) {
    throw D.error.notImplemented
  }

  async queryRawTx (txId) {
    throw D.error.notImplemented
  }

  async sendTx (rawTx) {
    throw D.error.notImplemented
  }

  async getBlockHeight () {
    throw D.error.notImplemented
  }
}
ICoinNetwork.provider = 'undefined'
