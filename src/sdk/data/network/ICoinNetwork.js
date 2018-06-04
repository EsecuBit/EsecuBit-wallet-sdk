
import D from '../../D'

const TYPE_ADDRESS = 'address'
const TYPE_TRANSACTION = 'transaction_info'
// TODO check block height to restart request
// seconds per request
let BLOCK_HEIGHT_REQUEST_PERIOD = 60
let TX_INCLUDED_REQUEST_PERIOD = 20

if (D.TEST_NETWORK_REQUEST) {
  BLOCK_HEIGHT_REQUEST_PERIOD = 20
  TX_INCLUDED_REQUEST_PERIOD = 10
}

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
    console.info(this.coinType, 'current block height', this._blockHeight)

    // start the request loop
    this._startQueue = true
    let queue = () => {
      for (let request of this._requestList) {
        if (request.type === TYPE_TRANSACTION && new Date().getTime() > request.nextTime) {
          request.nextTime = new Date().getTime() + TX_INCLUDED_REQUEST_PERIOD * 1000
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
    let blockHeightRequest = async () => {
      let newBlockHeight = await this.getBlockHeight()
      if (newBlockHeight !== this._blockHeight) {
        this._blockHeight = newBlockHeight
        console.debug(this.coinType + ' has new block height ' + this._blockHeight)
      }
      setTimeout(blockHeightRequest, BLOCK_HEIGHT_REQUEST_PERIOD * 1000)
    }
    setTimeout(blockHeightRequest, BLOCK_HEIGHT_REQUEST_PERIOD * 1000)

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
      callback: callback,
      type: TYPE_TRANSACTION,
      txInfo: txInfo,
      hasRecord: false,
      currentBlock: -1,
      nextTime: 0,
      request: async function () {
        let response
        try {
          if (!this.hasRecord) response = await that.queryTx(this.txInfo.txId)
        } catch (e) {
          if (e === D.ERROR_TX_NOT_FOUND) {
            console.info('tx not found in network, continue. id: ', txInfo.txId)
            return
          }
          callback(e, this.txInfo)
        }
        let confirmations = response.blockNumber ? that._blockHeight - response.blockNumber : 0

        if (confirmations > 0) this.hasRecord = true
        if (confirmations >= D.TX_BTC_MATURE_CONFIRMATIONS) {
          console.info('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        if (this.txInfo.confirmations !== confirmations) {
          this.txInfo.confirmations = confirmations
          callback(D.ERROR_NO_ERROR, this.txInfo)
        }
      }
    })
  }

  removeListener(callback) {
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
        type: TYPE_ADDRESS,
        currentBlock: -1,
        request: async () => {
          task.request()
            .then(blobs => blobs.forEach(
              blob => callback(D.ERROR_NO_ERROR, blob.addressInfo, blob.txInfo, blob.utxos)))
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
        let input = tx.inputs.find(input => addressInfo.address === input.address)
        let direction = input ? D.TX_DIRECTION_OUT : D.TX_DIRECTION_IN
        let txInfo = {
          accountId: addressInfo.accountId,
          coinType: addressInfo.coinType,
          txId: tx.txId,
          version: tx.version,
          blockNumber: tx.blockNumber,
          confirmations: tx.confirmations,
          time: tx.time,
          direction: direction,
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
            spent: D.UTXO_UNSPENT
          }
        })
        utxos.push(...unspentUtxos)

        let spentInputs = tx.inputs.filter(input => addressInfo.address === input.prevAddress)
        if (spentInputs.length > 0) {
          if (!spentInputs[0].prevTxId) {
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
              spent: tx.confirmations === 0 ? D.UTXO_SPENT_PENDING : D.UTXO_SPENT
            }
          })
          utxos.push(...spentUtxos)
        }
        return {addressInfo, txInfo, utxos}
      }

      // TODO test address1 + address1 => address1 + address1
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
   * @see queryTx
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
   *    time: long,
   *    hasDetails: bool,   // for queryAddress only, whether the tx has inputs and outputs. e.g. blockchain.info -> true, chain.so -> false
   *    intputs: [{prevAddress, value(bitcoin -> santoshi)}],
   *    outputs: [{address, value(bitcoin -> santoshi)}, index, script]
   * }
   *
   */
  async queryTx (txId) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async queryRawTx (txId) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async sendTx (rawTx) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async getBlockHeight () {
    throw D.ERROR_NOT_IMPLEMENTED
  }
}
ICoinNetwork.provider = 'undefined'
