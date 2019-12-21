import D from '../../D'
import ICoinNetwork from './ICoinNetwork'
import BigInteger from 'bigi'
import Url from 'url-parse'
import Axios, {SERVER} from './Axios'

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

let proxyPath = {}
proxyPath[D.coin.main.eth] = 'eth/main'
proxyPath[D.coin.test.ethRopsten] = 'eth/ropsten'
proxyPath[D.coin.test.ethRinkeby] = 'eth/rinkeby'

export default class EtherScanIo extends ICoinNetwork {
  async init () {
    this._proxyApiUrl = [SERVER, proxyPath[this.coinType]].join('/')
    this._apiUrl = Axios.isProxy() ? this._proxyApiUrl : apiUrls[this.coinType]
    this._txUrl = txUrls[this.coinType]
    this.provider = urls[this.coinType]
    if (!this._apiUrl) throw D.error.coinNotSupported
    return super.init()
  }

  async get (url, isQueryTx = false, proxy = false) {
    try {
      let response = await super.get(url)
      if (response.error) {
        console.warn('etherscan.io get error', response.error)
        throw D.error.networkProviderError
      }
      if (!response.result) {
        if (isQueryTx) {
          throw D.error.networkTxNotFound
        }
        console.warn('etherscan.io get result null', response)
        throw D.error.networkProviderError
      }
      return response.result
    } catch (error) {
      let request = error.request
      if (request.status === 500) {
        throw D.error.networkProviderError
      } else if (request.status === 0) {
        if (proxy || Axios.isDirect()) {
          console.warn('EtherScanIo get error', D.error.networkConnectTimeout)
          throw D.error.networkConnectTimeout
        }
        let URL = new Url(url)
        let path = this._proxyApiUrl.concat(URL.pathname, URL.query)
        console.debug('url is not avaliable, try to forward to proxy server', path)
        return this.get(path, isQueryTx, true)
      } else {
        console.warn('etherscan.io connect error', request)
        throw D.error.networkUnavailable
      }
    }
  }

  async post (url, args, proxy = false) {
    try {
      let response = await super.post(url, args)
      if (response.error) {
        console.warn('etherscan.io post error', response.error)
        let message = response.error.message
        if (message === 'transaction underpriced') {
          throw D.error.networkGasPriceTooLow
        } else if (message === 'intrinsic gas too low') {
          throw D.error.networkGasTooLow
        } else {
          throw D.error.networkProviderError
        }
      }
      if (!response.result) {
        console.warn('etherscan.io post result null', response)
        throw D.error.networkProviderError
      }
      return response.result
    } catch (error) {
      let request = error.request
      if (request.status === 500) {
        throw D.error.networkProviderError
      } else if (request.status === 0) {
        if (proxy || Axios.isDirect()) {
          console.warn('EtherScanIo get error', D.error.networkConnectTimeout)
          throw D.error.networkConnectTimeout
        }
        let URL = new Url(url)
        let path = this._proxyApiUrl.concat(URL.pathname, URL.query)
        console.debug('url is not avaliable, try to forward to proxy server', path)
        return this.post(path, args, true)
      } else {
        console.warn('etherscan.io connect error', error.request)
        throw D.error.networkUnavailable
      }
    }
  }

  getTxLink (txInfo) {
    return this._txUrl + txInfo.txId
  }

  async getBlockHeight () {
    let response = await this.get(this._apiUrl + '/api?module=proxy&action=eth_blockNumber')
    return parseInt(response)
  }

  async queryAddress (address, offset = 0) {
    let responseEth = await this.get(this._apiUrl + '/api?module=account&action=txlist&address=' + address)
    responseEth = responseEth.map(tx => this._wrapTx(tx))

    let responseToken = await this.get(this._apiUrl + '/api?module=account&action=tokentx&address=' + address)
    responseToken = responseToken.map(tx => this._wrapTx(tx, true))

    let response = []
    response.push(...responseEth)
    response.push(...responseToken)

    return {
      address: address,
      txCount: response.length,
      txs: response
    }
  }

  async queryTokenAddress (address, offset = 0) {
    let response = await this.get(this._apiUrl + '/api?module=account&action=tokentx&address=' + address)
    return {
      address: address,
      txCount: response.length,
      txs: response.map(tx => this._wrapTx(tx))
    }
  }

  async isToken (address) {
    let response = await this.get(this._apiUrl + '/api?module=stats&action=tokensupply&contractaddress=' + address)
    return !!((response && response.result !== '0'))
  }

  async queryTx (txId) {
    let response = await this.get(this._apiUrl + '/api?module=proxy&action=eth_getTransactionByHash&txhash=' + txId, true)
    return this._wrapTx(response)
  }

  async sendTx (rawTransaction) {
    return this.post(this._apiUrl + '/api?module=proxy&action=eth_sendRawTransaction', 'hex=' + rawTransaction)
  }

  _wrapTx (rTx, isToken = false) {
    // if no blockNumber, that tx is in the pool, and confirmations should be 0
    let blockNumber = Number(rTx.blockNumber) || (this._blockHeight + 1)
    let confirmations = Number(rTx.confirmations) || (this._blockHeight - blockNumber + 1)
    // confirmations < 0 means this._blockHeight is not the newest. In this case confirmations is at least 1
    confirmations = confirmations < 0 ? 1 : confirmations

    if (rTx.gas.startsWith('0x')) {
      rTx.gas = rTx.gas.slice(2)
      rTx.gas = rTx.gas.length % 2 === 0 ? '' : '0' + rTx.gas
      rTx.gas = BigInteger.fromHex(rTx.gas).toString(10)
    }
    if (rTx.gasPrice.startsWith('0x')) {
      rTx.gasPrice = rTx.gasPrice.slice(2)
      rTx.gasPrice = (rTx.gasPrice.length % 2 === 0 ? '' : '0') + rTx.gasPrice
      rTx.gasPrice = BigInteger.fromHex(rTx.gasPrice).toString(10)
    }

    let value = new BigInteger(rTx.value)
    let tx = {
      txId: rTx.hash,
      blockNumber: blockNumber,
      confirmations: confirmations,
      time: rTx.timeStamp * 1000,
      gas: rTx.gasUsed || rTx.gas,
      gasPrice: rTx.gasPrice,
      data: rTx.input,
      nonce: rTx.nonce ? parseInt(rTx.nonce) : undefined,
      hasDetails: true,
      contractAddress: rTx.contractAddress,
      isToken: isToken
    }
    if (isToken) {
      tx.txId = tx.txId + '_t'
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
