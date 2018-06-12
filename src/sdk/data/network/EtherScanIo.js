
import D from '../../D'
import ICoinNetwork from './ICoinNetwork'

const testRinkebyUrl = 'https://api-rinkeby.etherscan.io/api'
const mainUrl = 'https://api.etherscan.io/api'

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

  async getBlockHeight () {
    let response = await this.get(this._apiUrl + '?module=proxy&action=eth_blockNumber')
    return parseInt(response)
  }

  async queryAddress (address) {
    let response = await this.get(this._apiUrl + '?module=account&action=txlist&address=' + address)
    return {
      address: address,
      txCount: response.length,
      txs: response.map(tx => this.wrapTx(tx))
    }
  }

  async queryTx (txId) {
    let response = await this.get(this._apiUrl + '?module=proxy&action=eth_getTransactionByHash&txhash=' + txId)
    return this.wrapTx(response)
  }

  async sendTx (rawTransaction) {
    return this.post(this._apiUrl + '?module=proxy&action=eth_sendRawTransaction&hex=' + rawTransaction)
  }

  wrapTx (rTx) {
    let confirmations = Number(rTx.confirmations) || (this._blockHeight - (Number(rTx.blockNumber) || this._blockHeight))
    let tx = {
      txId: rTx.hash,
      blockNumber: Number(rTx.blockNumber),
      confirmations: confirmations,
      time: Number(rTx.timeStamp) * 1000,
      gas: Number(rTx.gas),
      gasPrice: Number(rTx.gasPrice),
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