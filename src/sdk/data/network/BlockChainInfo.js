import ICoinNetwork from './ICoinNetwork'
import D from '../../D'
import Url from 'url-parse'
import Axios, { SERVER } from './Axios'

const testApiUrl = 'https://testnet.blockchain.info'
const mainApiUrl = 'https://blockchain.info'

const testProxyPath = 'btc/test'
const mainProxyPath = 'btc/main'

const testTxUrl = 'https://testnet.blockchain.info/tx/'
const mainTxUrl = 'https://blockchain.info/tx/'

const testUrl = 'testnet.blockchain.info'
const mainUrl = 'blockchain.info'

export default class BlockChainInfo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = true
    this.indexMap = {}
  }

  async init () {
    switch (this.coinType) {
      case D.coin.main.btc:
        this._proxyApiUrl = [SERVER, mainProxyPath].join('/')
        this._apiUrl = Axios.isProxy() ? this._proxyApiUrl : mainApiUrl
        this._txUrl = mainTxUrl
        this.provider = mainUrl
        break
      case D.coin.test.btcTestNet3:
        this._proxyApiUrl = [SERVER, testProxyPath].join('/')
        this._apiUrl = Axios.isProxy() ? this._proxyApiUrl : testApiUrl
        this._txUrl = testTxUrl
        this.provider = testUrl
        break
      default:
        console.warn('BlockChainInfo don\'t support this coinType', this.coinType)
        throw D.error.coinNotSupported
    }
    return super.init()
  }

  async get (url, proxy = false) {
    try {
      let response = await super.get(url)
      console.log('BlockChainInfo get response', response)
      return response
    } catch (error) {
      console.warn('BlockChainInfo get', url, error)
      let request = error.request
      if (request.status === 500) {
        let response = request.responseText
        if (response.includes('Transaction not found')) {
          throw D.error.networkTxNotFound
        } else {
          throw D.error.networkProviderError
        }
      } else if (request.status === 0) {
        if (proxy || Axios.isDirect()) {
          console.warn('BlockchainInfo get error', D.error.networkConnectTimeout)
          throw D.error.networkConnectTimeout
        }
        let URL = new Url(url)
        let path = this._proxyApiUrl.concat(URL.pathname, URL.query)
        console.debug('url is not avaliable, try to forward to proxy server', path)
        return this.get(path, true)
      } else {
        console.warn(url, error.request)
        throw D.error.networkUnavailable
      }
    }
  }

  async post (url, args, proxy = false) {
    try {
      let response = await super.post(url, args)
      console.log('BlockChainInfo post response', response)
      return response
    } catch (error) {
      let request = error.request
      if (error.request.status === 500) {
        console.warn('BlockChainInfo post', request)
        let response = request.responseText
        if (response.includes('min relay fee not met')) {
          throw D.error.networkFeeTooSmall
        } else if (response.includes('Too many pending transactions')) {
          throw D.error.networkTooManyPendingTx
        } else if (response.includes('dust')) {
          throw D.error.networkValueTooSmall
        } else {
          throw D.error.networkProviderError
        }
      } else if (request.status === 0) {
        if (proxy || Axios.isDirect()) {
          console.warn('BlockchainInfo get error', D.error.networkConnectTimeout)
          throw D.error.networkConnectTimeout
        }
        let URL = new Url(url)
        let path = this._proxyApiUrl.concat(URL.pathname, URL.query)
        console.debug('url is not avaliable, try to forward to proxy server', path, args)
        return this.post(path, args, true)
      } else {
        console.warn(url, request)
        throw D.error.networkUnavailable
      }
    }
  }

  getTxLink (txInfo) {
    return this._txUrl + txInfo.txId
  }

  async getBlockHeight () {
    if (D.test.coin) {
      let url = 'https://api.blockcypher.com/v1/btc/test3'
      let response = await this.get(url)
      return parseInt(response.height)
    }
    return parseInt(await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/')))
  }

  async queryAddresses (addresses, offset = 0) {
    // blockchain.info return 502 when addresses.length > 141, it seems a bug of them
    const maxAddressesSize = 140
    let response = {
      txs: [],
      addresses: []
    }
    while (offset < addresses.length) {
      let querySize = addresses.length - offset
      if (querySize > maxAddressesSize) querySize = maxAddressesSize
      let subResponse = await this._queryAddresses(addresses.slice(offset, offset + querySize))
      response.txs.push(...subResponse.txs)
      response.addresses.push(...subResponse.addresses)
      offset += querySize
    }

    let selfTx = (rTx, address) => {
      return rTx.inputs.map(input => input.prev_out.addr).includes(address) ||
        rTx.out.map(output => output.addr).includes(address)
    }

    let blobs = []
    for (let rAddress of response.addresses) {
      let txs = response.txs.filter(rTx => selfTx(rTx, rAddress.address))
      txs = await Promise.all(txs.map(rTx => this._wrapTx(rTx, rAddress.address)))
      blobs.push({
        address: rAddress.address,
        txCount: rAddress.n_tx,
        txs: txs
      })
    }

    return blobs
  }

  async _queryAddresses (addresses) {
    let totalReceive = 0
    let response
    while (true) {
      let subResponse = await this.get(this._apiUrl + '/multiaddr?cors=true&offset=' + totalReceive + '&n=100&active=' + addresses.join('|'))
      if (!response) {
        response = subResponse
      } else {
        // noinspection JSUnusedAssignment
        response.txs.push(...subResponse.txs)
      }
      totalReceive = response.txs.length
      if (totalReceive >= response.wallet.n_tx) {
        break
      }
    }

    response.txs.forEach(tx => {
      if (!this.indexMap[tx.tx_index]) {
        this.indexMap[tx.tx_index] = tx.hash
      }
    })

    return response
  }

  async queryTx (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true')
    return this._wrapTx(response)
  }

  async queryRawTx (txId) {
    if (D.test.coin) {
      let url = 'https://api.blockcypher.com/v1/btc/test3/txs/' + txId + '?includeHex=true'
      let response = await this.get(url)
      return D.parseBitcoinRawTx(response.hex)
    }
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true&format=hex')
    return D.parseBitcoinRawTx(response.response)
  }

  sendTx (rawTransaction) {
    return this.post([this._apiUrl, 'pushtx'].join('/'), 'tx=' + rawTransaction)
  }

  async _wrapTx (rTx, address) {
    let confirmations = this._blockHeight - (rTx.block_height || this._blockHeight)
    let tx = {
      txId: rTx.hash,
      version: rTx.ver,
      blockNumber: rTx.block_height || -1,
      confirmations: confirmations,
      time: rTx.time * 1000,
      // when query address(es) from blockchain.info, the response of tx may missing some outputs if
      // one address is in outputs and other outputs is not in your address(es) list.
      // blockchain.info may think other outputs is not your concern.. but it's really annoying.
      // see: https://testnet.blockchain.info/multiaddr?cors=true&offset=0&n=100&active=mkscdDdESTD5KUyvNFAYEGPmhKM8fC9REZ
      // in this case, we need to mark tx as 'not completed' and get the full tx later.
      // ps: this only makes troubles when you transfer coin to your own address and make a change
      hasDetails: (rTx.inputs.length === rTx.vin_sz) && (rTx.out.length === rTx.vout_sz)
    }
    let index = 0
    tx.inputs = await Promise.all(rTx.inputs.map(async input => {
      // blockchain.info don't have this field, but we can get it from txs by tx_index if
      // prevAddress is one of the addresses we query. otherwise prevTxId is useless
      let prevTxId = this.indexMap[input.prev_out.tx_index]
      if (!prevTxId && (input.prev_out.addr === address)) {
        console.debug('tx_index not found, get it by queryRawTx', rTx)
        let response = await this.queryRawTx(rTx.hash)
        prevTxId = response.in.find(inn => inn.index === input.prev_out.n).hash
        this.indexMap[input.prev_out.tx_index] = prevTxId
      }
      return {
        prevAddress: input.prev_out.addr,
        prevTxId: prevTxId,
        prevOutIndex: input.prev_out.n,
        prevOutScript: input.prev_out.script,
        index: index++,
        value: input.prev_out.value
      }
    }))
    tx.outputs = rTx.out.map(output => {
      return {
        address: output.addr,
        value: output.value,
        index: output.n,
        script: output.script
      }
    })
    return tx
  }
}
BlockChainInfo.provider = 'blockchain.info'
