
import D from '../../D'
import ICoinNetwork from './ICoinNetwork'
import BigInteger from 'bigi'

let apiUrls = {}
apiUrls[D.coin.main.eth] = 'https://api.etherscan.io'
apiUrls[D.coin.test.ethRinkeby] = 'https://api-rinkeby.etherscan.io'
apiUrls[D.coin.test.ethRopsten] = 'https://api-ropsten.etherscan.io'

let txUrls = {}
txUrls[D.coin.main.eth] = 'https://etherscan.io/tx/'
txUrls[D.coin.test.ethRinkeby] = 'https://rinkeby.etherscan.io/tx/'
txUrls[D.coin.test.ethRopsten] = 'https://ropsten.etherscan.io/tx/'

let urls = {}
urls[D.coin.main.eth] = 'etherscan.io'
urls[D.coin.test.ethRinkeby] = 'rinkeby.etherscan.io'
urls[D.coin.test.ethRopsten] = 'ropsten.etherscan.io'

export default class EtherScanIo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    this.coinType = coinType
  }

  async init () {
    this._apiUrl = apiUrls[this.coinType]
    this._txUrl = txUrls[this.coinType]
    this.provider = urls[this.coinType]
    if (!this._apiUrl) throw D.error.coinNotSupported
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
    return this._txUrl + txInfo.txId
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

    let value = new BigInteger(rTx.value)
    let tx = {
      txId: rTx.hash,
      blockNumber: blockNumber,
      confirmations: confirmations,
      time: rTx.timeStamp * 1000,
      gas: rTx.gas,
      gasPrice: rTx.gasPrice,
      hasDetails: true
    }
    tx.inputs = [{
      prevAddress: rTx.from,
      value: value.toString(10)
    }]
    tx.outputs = [{
      address: rTx.to,
      value: value.toString(10)
    }]
    return tx
  }
}
EtherScanIo.provider = 'etherscan.io'
