
import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

const TEST_URL = 'https://testnet.blockchain.info'
const MAIN_URL = 'https://blockchain.info'

export default class BlockchainInfo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = true
    this.coinType = coinType
  }

  async init () {
    switch (this.coinType) {
      case D.COIN_BIT_COIN:
        this._apiUrl = MAIN_URL
        break
      case D.COIN_BIT_COIN_TEST:
        this._apiUrl = TEST_URL
        break
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
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
                reject(D.ERROR_TX_NOT_FOUND)
                return
              default:
                console.warn('BlockChainInfo get', xmlhttp)
                reject(D.ERROR_NETWORK_PROVIDER_ERROR)
            }
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

  async getBlockHeight () {
    return parseInt(await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/')))
  }

  async queryAddresses (addresses) {
    let response = await this.get(this._apiUrl + '/multiaddr?cors=true&active=' + addresses.join('|'))
    let addressInfos = []
    for (let rAddress of response.addresses) {
      let exist = (io) => {
        let address = io.addr || io.prev_out.addr
        return address === rAddress.address
      }
      let info = {}
      info.address = rAddress.address
      info.txCount = rAddress.n_tx
      info.txs = response.txs
        .filter(rTx => rTx.inputs.some(exist) || rTx.out.some(exist))
        .map(rTx => this.wrapTx(rTx))
      addressInfos.push(info)
    }
    return addressInfos
  }

  async queryTx (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true')
    return this.wrapTx(response)
  }

  async queryRawTx (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true&format=hex')
    return D.parseRawTx(response.response)
  }

  async sendTx (rawTransaction) {
    // TODO uncomment after testing EsAccount
    let response = await this.post([this._apiUrl, 'pushtx'].join('/'), 'tx=' + rawTransaction)
    // TODO wrap
    return response
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
