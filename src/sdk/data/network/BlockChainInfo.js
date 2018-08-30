
import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

const testApiUrl = 'https://testnet.blockchain.info'
const mainApiUrl = 'https://blockchain.info'

const testTxUrl = 'https://testnet.blockchain.info/tx/'
const mainTxUrl = 'https://blockchain.info/tx/'

const testUrl = 'testnet.blockchain.info'
const mainUrl = 'blockchain.info'

export default class BlockchainInfo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = true
    this.coinType = coinType
    this.indexMap = {}
  }

  async init () {
    switch (this.coinType) {
      case D.coin.main.btc:
        this._apiUrl = mainApiUrl
        this._txUrl = mainTxUrl
        this.provider = mainUrl
        break
      case D.coin.test.btcTestNet3:
        this._apiUrl = testApiUrl
        this._txUrl = testTxUrl
        this.provider = testUrl
        break
      default:
        throw D.error.coinNotSupported
    }
    return super.init()
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
            console.warn('BlockChainInfo get', xmlhttp)
            let response = xmlhttp.responseText
            if (response.includes('Transaction not found')) {
              reject(D.error.networkTxNotFound)
            } else {
              reject(D.error.networkProviderError)
            }
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
            console.warn('BlockChainInfo post', xmlhttp)
            let response = xmlhttp.responseText
            if (response.includes('min relay fee not met')) {
              reject(D.error.networkFeeTooSmall)
            } else if (response.includes('Too many pending transactions')) {
              reject(D.error.networkTooManyPendingTx)
            } else if (response.includes('dust')) {
              reject(D.error.networkValueTooSmall)
            } else {
              reject(D.error.networkProviderError)
            }
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

  getTxLink (txInfo) {
    return this._txUrl + txInfo.txId
  }

  async getBlockHeight () {
    return parseInt(await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/')))
  }

  async queryAddresses (addresses) {
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

    let selfTx = (rTx, address) => {
      return rTx.inputs.map(input => input.prev_out.addr).includes(address) ||
        rTx.out.map(output => output.addr).includes(address)
    }

    let blobs = []
    for (let rAddress of response.addresses) {
      let txs = response.txs.filter(rTx => selfTx(rTx, rAddress.address))
      txs = await Promise.all(txs.map(rTx => this.wrapTx(rTx, rAddress.address)))
      blobs.push({
        address: rAddress.address,
        txCount: rAddress.n_tx,
        txs: txs
      })
    }
    return blobs
  }

  async queryTx (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true')
    return this.wrapTx(response)
  }

  async queryRawTx (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true&format=hex')
    return D.parseBitcoinRawTx(response.response)
  }

  sendTx (rawTransaction) {
    return this.post([this._apiUrl, 'pushtx'].join('/'), 'tx=' + rawTransaction)
  }

  async wrapTx (rTx, address) {
    let confirmations = this._blockHeight - (rTx.block_height || this._blockHeight)
    let tx = {
      txId: rTx.hash,
      version: rTx.ver,
      blockNumber: rTx.block_height || -1,
      confirmations: confirmations,
      time: rTx.time * 1000,
      // if you query a single address, it may missing some outputs. see
      // https://testnet.blockchain.info/multiaddr?cors=true&offset=0&n=100&active=mkscdDdESTD5KUyvNFAYEGPmhKM8fC9REZ
      // this only makes troubles when you transfer coin to your own address and make a change
      hasDetails: (rTx.inputs.length === rTx.vin_sz) && (rTx.out.length === rTx.vout_sz)
    }
    let index = 0
    tx.inputs = await Promise.all(rTx.inputs.map(async input => {
      // blockchain.info don't have this field, but we can get it from txs by tx_index,
      // if prevAddress is the address we query. otherwise prevTxId is useless
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
BlockchainInfo.provider = 'blockchain.info'
