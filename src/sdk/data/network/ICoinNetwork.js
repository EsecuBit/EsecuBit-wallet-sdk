
import D from '../../D'

const TYPE_ADDRESS = 'address'
const TYPE_TRANSACTION_INFO = 'transaction_info'
// TODO check block height to restart request
// seconds per request
let BLOCK_HEIGHT_REQUEST_PERIOD = 60

if (D.TEST_NETWORK_REQUEST) {
  BLOCK_HEIGHT_REQUEST_PERIOD = 20
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
    console.info(this.coinType + ' current block height ' + this._blockHeight)

    // start the request loop
    this._startQueue = true
    let queue = () => {
      for (let request of this._requestList) {
        if (!request) {
          // TODO one time
          console.warn('a removed request')
          continue
        }
        if (request.currentBlock < this._blockHeight) {
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
      type: TYPE_TRANSACTION_INFO,
      txInfo: txInfo,
      response: null,
      currentBlock: -1,
      nextTime: 0, // TODO check transaction from miners memory pool
      request: async function () {
        try {
          if (!this.response) this.response = await that.queryTx(this.txInfo.txId)
        } catch (e) {
          if (e === D.ERROR_TX_NOT_FOUND) {
            console.info('tx not found in network, continue. id: ', txInfo.txId)
            return
          }
          callback(e, this.txInfo)
        }
        let confirmations = this.response.confirmations === 0 ? 0 : this._blockHeight - this.response.blockNumber
        if (confirmations >= D.TX_BTC_MATURE_CONFIRMATIONS) {
          console.info('confirmations enough, remove', this)
          remove(that._requestList, this)
        }
        if (this.response.confirmations !== confirmations) {
          this.response.confirmations = confirmations
          callback(D.ERROR_NO_ERROR, this.txInfo)
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
      let newTransaction = async (addressInfo, tx) => {
        console.info('newTransaction', addressInfo, tx)
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
            spent: D.TX_UNSPENT
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
              spent: tx.confirmations === 0 ? D.TX_SPENT_PENDING : D.TX_SPENT
            }
          })
          utxos.push(...spentUtxos)
        }

        // TODO test address1 + address1 => address1 + address1
        callback(D.ERROR_NO_ERROR, addressInfo, txInfo, utxos)
      }

      let newTxs = response.txs.filter(tx => !addressInfo.txs.some(txId => txId === tx.txId))
      newTxs.forEach(tx => { if (tx.confirmations > 0) addressInfo.txs.push(tx.txId) })
      // noinspection JSCheckFunctionSignatures
      newTxs.filter(tx => tx.hasDetails).forEach(tx => newTransaction(addressInfo, tx))
      newTxs.filter(tx => !tx.hasDetails).forEach(
        tx => that._network[addressInfo.coinType].queryTx(tx.txId)
          .then(tx => newTransaction(addressInfo, tx))
          .catch(callback))
    }

    const that = this
    if (this._supportMultiAddresses) {
      let addressMap = {}
      addressInfos.forEach(addressInfo => { addressMap[addressInfo.address] = addressInfo })
      this._requestList.push({
        type: TYPE_ADDRESS,
        addressMap: addressMap,
        oneTime: oneTime,
        currentBlock: -1,
        request: function () {
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
          currentBlock: -1,
          request: async function () {
            that.queryAddress(this.addressInfo.address)
              .then(async response => {
                await checkNewTx(response, this.addressInfo)
                oneTime && remove(that._requestList, this)
              })
              .catch(callback)
          }
        })
      }
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
