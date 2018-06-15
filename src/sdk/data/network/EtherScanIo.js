
import D from '../../D'
import ICoinNetwork from './ICoinNetwork'

const testRinkebyUrl = 'https://api-rinkeby.etherscan.io'
const mainUrl = 'https://api.etherscan.io'

export default class EtherScanIo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    this.coinType = coinType
  }

  async init () {
    switch (this.coinType) {
      case D.coin.main.eth:
        this._apiUrl = mainUrl
        break
      case D.coin.test.ethRinkeby:
        this._apiUrl = testRinkebyUrl
        break
      default:
        throw D.error.coinNotSupported
    }
    return super.init()
  }

  async get (url) {
    let response = await super.get(url)
    if (response.error) {
      console.warn('etherscan.io get error', response.error)
      throw D.error.networkProviderError
    }
    if (!response.result) {
      console.warn('etherscan.io get result null', response)
      throw D.error.networkProviderError
    }
    return response.result
  }

  async post (url, args) {
    let response = await super.post(url, args)
    if (response.error) {
      console.warn('etherscan.io post error', response.error)
      throw D.error.networkProviderError
    }
    if (!response.result) {
      console.warn('etherscan.io post result null', response)
      throw D.error.networkProviderError
    }
    return response.result
  }

  getTxLink (txInfo) {
    let urls = {}
    urls[D.coin.main.eth] = 'https://etherscan.io/tx/'
    urls[D.coin.test.ethRinkeby] = 'https://rinkeby.etherscan.io/tx/'
    let url = urls[txInfo.coinType]
    if (!url) throw D.error.coinNotSupported
    return url + txInfo.txId
  }

  async getBlockHeight () {
    let response = await this.get(this._apiUrl + '/api?module=proxy&action=eth_blockNumber')
    return parseInt(response)
  }

  async queryAddress (address) {
    let response = await this.get(this._apiUrl + '/api?module=account&action=txlist&address=' + address)
    return {
      address: address,
      txCount: response.length,
      txs: response.map(tx => this.wrapTx(tx))
    }
  }

  async queryTx (txId) {
    let response = await this.get(this._apiUrl + '/api?module=proxy&action=eth_getTransactionByHash&txhash=' + txId)
    return this.wrapTx(response)
  }

  async sendTx (rawTransaction) {
    return this.post(this._apiUrl + '/api?module=proxy&action=eth_sendRawTransaction', 'hex=' + rawTransaction)
  }

  wrapTx (rTx) {
    // if no blockNumber, that tx is in the pool, and confirmations should be 0
    let blockNumber = Number(rTx.blockNumber) || (this._blockHeight + 1)
    let confirmations = Number(rTx.confirmations) || (this._blockHeight - blockNumber + 1)
    // confirmations < 0 means this._blockHeight is not the newest. In this case confirmations is at least 1
    confirmations = confirmations < 0 ? 1 : confirmations
    let tx = {
      txId: rTx.hash,
      blockNumber: Number(rTx.blockNumber),
      confirmations: confirmations,
      time: Number(rTx.timeStamp) * 1000,
      gas: Number(rTx.gas),
      gasPrice: Number(rTx.gasPrice),
      fee: Number(rTx.gas) * Number(rTx.gasPrice),
      hasDetails: true
    }
    tx.inputs = [{
      prevAddress: rTx.from,
      value: Number(rTx.value)
    }]
    tx.outputs = [{
      address: rTx.to,
      value: Number(rTx.value)
    }]
    return tx
  }
}
EtherScanIo.provider = 'etherscan.io'
