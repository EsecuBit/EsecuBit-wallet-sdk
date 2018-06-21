
import D from '../../D'

const typeAddress = 'address'
const typeTx = 'tx'

export default class ICoinNetwork {
  constructor (coinType) {
    this.coinType = coinType
    this._startQueue = false
    this._blockHeight = -1
    this._supportMultiAddresses = false
    this._requestRate = 1 // seconds per request
    this._requestList = []
  }

  async init () {
    this._blockHeight = await this.getBlockHeight()
    console.log(this.coinType, 'current block height', this._blockHeight)

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
        }
      }
      if (this._startQueue) {
        setTimeout(queue, this._requestRate * 1000)
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
    setTimeout(blockHeightRequest, blockHeightRequestPeriod * 1000)

    return {blockHeight: this._blockHeight}
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
   * @returns {{blockHeightRequestPeriod: number, txIncludedRequestPeriod: number}}
   */
  getRequestPeroid () {
    if (!D.isBtc(this.coinType) && !D.isEth(this.coinType)) throw D.error.coinNotSupported
    let blockHeightRequestPeriod = 60
    let txIncludedRequestPeriod = 60
    if (D.test.mode) {
      if (D.isBtc(this.coinType)) {
        blockHeightRequestPeriod = 20
        txIncludedRequestPeriod = 10
      } else if (D.isEth(this.coinType)) {
        blockHeightRequestPeriod = 10
        // eth is quick enough that not need tx included request
        txIncludedRequestPeriod = Number.MAX_SAFE_INTEGER
      }
    } else {
      if (D.isBtc(this.coinType)) {
        blockHeightRequestPeriod = 60
        txIncludedRequestPeriod = 30
      } else if (D.isEth(this.coinType)) {
        blockHeightRequestPeriod = 10
        // eth is quick enough that not need tx included request
        txIncludedRequestPeriod = Number.MAX_SAFE_INTEGER
      }
    }
    return {blockHeightRequestPeriod, txIncludedRequestPeriod}
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
      callback: callback,
      type: typeTx,
      txInfo: txInfo,
      hasRecord: false,
      currentBlock: -1,
      nextTime: 0,
      request: async function () {
        let response = {}
        try {
          if (!this.hasRecord) response = await that.queryTx(this.txInfo.txId)
        } catch (e) {
          if (e === D.error.txNotFound) {
            console.log('tx not found in btcNetwork, continue. id: ', txInfo.txId)
            return
          }
          callback(e, this.txInfo)
          return
        }
        let blockNumber = response.blockNumber ? response.blockNumber : txInfo.blockNumber
        let confirmations = blockNumber > 0 ? (that._blockHeight - blockNumber + 1) : 0

        if (confirmations > 0) this.hasRecord = true
        if (confirmations >= D.tx.getMatureConfirms(txInfo.coinType)) {
          console.log('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        if (confirmations > txInfo.confirmations) {
          txInfo.blockNumber = blockNumber
          txInfo.confirmations = confirmations
          callback(D.error.succeed, txInfo)
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
              blob => callback(D.error.succeed, blob.addressInfo, blob.txInfo, blob.utxos)))
            // TODO retry
            // TODO callback error once
            .catch(e => callback(e))
        }
      })
    })
  }

  /**
   * get all the new transactions provided addresseses immediately
   */
  async checkAddresses (addressInfos) {
    return Promise.all(this.generateAddressTasks(addressInfos).map(task => task.request()))
      .then(blobs => blobs.reduce((array, item) => array.concat(item), []))
  }

  generateAddressTasks (addressInfos) {
    let checkNewTx = async (response, addressInfo) => {
      let newTransaction = async (addressInfo, tx) => {
        let fee = 0
        if (D.isEth(this.coinType)) {
          fee = tx.gas * tx.gasPrice
        } else {
          fee += tx.inputs.reduce((sum, input) => sum + input.value, 0)
          fee -= tx.outputs.reduce((sum, output) => sum + output.value, 0)
        }

        let txInfo = {
          accountId: addressInfo.accountId,
          coinType: addressInfo.coinType,
          txId: tx.txId,
          version: tx.version ? tx.version : 0,
          blockNumber: tx.blockNumber,
          confirmations: tx.confirmations,
          time: tx.time,
          fee: fee,
          inputs: tx.inputs,
          outputs: tx.outputs
        }
        let utxos = []
        let unspentOutputs = tx.outputs.filter(output => addressInfo.address === output.address)
        let unspentUtxos = unspentOutputs.map(output => {
          return {
            accountId: addressInfo.accountId,
            coinType: addressInfo.coinType,
            address: addressInfo.address,
            path: addressInfo.path,
            txId: tx.txId,
            index: output.index,
            script: output.script,
            value: output.value,
            spent: D.utxo.status.unspent
          }
        })
        utxos.push(...unspentUtxos)

        let spentInputs = tx.inputs.filter(input => addressInfo.address === input.prevAddress)
        if (spentInputs.length > 0) {
          if (D.isBtc(this.coinType) && !spentInputs[0].prevTxId) {
            // TODO queryRawTx request speed
            let formatTx = await this.queryRawTx(txInfo.txId)
            spentInputs.forEach(input => {
              input.prevTxId = formatTx.in[input.index].hash
            })
          }
          let spentUtxos = spentInputs.map(input => {
            return {
              accountId: addressInfo.accountId,
              coinType: addressInfo.coinType,
              address: addressInfo.address,
              path: addressInfo.path,
              txId: input.prevTxId,
              index: input.prevOutIndex,
              script: input.prevOutScript,
              value: input.value,
              spent: tx.confirmations === 0 ? D.utxo.status.pending : D.utxo.status.spent
            }
          })
          utxos.push(...spentUtxos)
        }
        return {addressInfo, txInfo, utxos}
      }

      let newTxs = response.txs.filter(tx => !addressInfo.txs.some(txId => txId === tx.txId))
      newTxs.forEach(tx => addressInfo.txs.push(tx.txId))
      return Promise.all(newTxs.map(async tx => {
        // TODO queryTx request speed
        if (!tx.hasDetails) tx = await this.queryTx(tx.txId)
        return newTransaction(addressInfo, tx)
      }))
    }

    const _this = this
    if (this._supportMultiAddresses) {
      let addressMap = {}
      addressInfos.forEach(addressInfo => { addressMap[addressInfo.address] = addressInfo })
      let addresses = Object.keys(addressMap)
      return [{request () {
        return _this.queryAddresses(addresses)
          .then(multiResponses => Promise.all(multiResponses.map(response => checkNewTx(response, addressMap[response.address]))))
          .then(blobs => blobs.reduce((array, item) => array.concat(item), []))
      }}]
    } else {
      return addressInfos.map(addressInfo => {
        return {request () {
          return _this.queryAddress(addressInfo.address).then(response => checkNewTx(response, addressInfo))
        }}
      })
    }
  }

  getTxLink (txInfo) {
    throw D.error.notImplemented
  }

  /**
   * @return addressInfo array
   * @see addressInfo
   */
  async queryAddresses (addresses) {
    throw D.error.notImplemented
  }

  /**
   * @return addressInfo:
   * {
   *    address: string,
   *    txCount: int,
   *    txs: tx array
   * }
   *
   * @see queryTx
   *
   */
  async queryAddress (address) {
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
   *    intputs: [{prevAddress, value(santoshi)}],
   *    outputs: [{address, value(santoshi)}, index, script]
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
   *    gas: long, // wei
   *    gasPrice: long // wei
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
