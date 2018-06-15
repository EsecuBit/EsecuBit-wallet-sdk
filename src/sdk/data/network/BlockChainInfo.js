
import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

const testUrl = 'https://testnet.blockchain.info'
const mainUrl = 'https://blockchain.info'

export default class BlockchainInfo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = true
    this.coinType = coinType
  }

  async init () {
    switch (this.coinType) {
      case D.coin.main.btc:
        this._apiUrl = mainUrl
        break
      case D.coin.test.btcTestNet3:
        this._apiUrl = testUrl
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
            let response = xmlhttp.responseText
            switch (response) {
              case 'Transaction not found':
                reject(D.error.txNotFound)
                return
              default:
                console.warn('BlockChainInfo get', xmlhttp)
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

  getTxLink (txInfo) {
    return [this._apiUrl, 'tx', txInfo.txId].join('/')
  }

  async getBlockHeight () {
    return parseInt(await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/')))
  }

  async queryAddresses (addresses) {
    let response = await this.get(this._apiUrl + '/multiaddr?cors=true&active=' + addresses.join('|'))
    let exist = (rTx, address) => {
      return rTx.inputs.map(input => input.prev_out.addr).includes(address) ||
        rTx.out.map(output => output.addr).includes(address)
    }
    return response.addresses.map(rAddress => {
      return {
        address: rAddress.address,
        txCount: rAddress.n_tx,
        txs: response.txs.filter(rTx => exist(rTx, rAddress.address)).map(rTx => this.wrapTx(rTx))
      }
    })
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

  wrapTx (rTx) {
    let confirmations = this._blockHeight - (rTx.block_height || this._blockHeight)
    let tx = {
      txId: rTx.hash,
      version: rTx.ver,
      blockNumber: rTx.block_height || -1,
      confirmations: confirmations,
      time: rTx.time * 1000,
      hasDetails: true
    }
    let index = 0
    tx.inputs = rTx.inputs.map(input => {
      return {
        prevAddress: input.prev_out.addr,
        prevTxId: null, // blockchain.info don't have this field, need query tx raw hex
        prevOutIndex: input.prev_out.n,
        prevOutScript: input.prev_out.script,
        index: index++,
        value: input.prev_out.value
      }
    })
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
