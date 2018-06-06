
import D from '../../D'
import ICoinNetwork from './ICoinNetwork'

const TEST_URL = 'https://api-ropsten.etherscan.io/api'
const MAIN_URL = 'https://api.etherscan.io'

export default class EtherScanIo extends ICoinNetwork {
  constructor (coinType) {
    super(coinType)
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = false
    this.coinType = coinType
  }

  async init () {
    switch (this.coinType) {
      case D.COIN_ETH:
        this._apiUrl = MAIN_URL
        break
      case D.COIN_ETH_TEST_ROPSTEN:
        this._apiUrl = TEST_URL
        break
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
    return super.init()
  }// https://api-ropsten.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=YourApiKeyToken

  async getBlockHeight () {
    let response = await this.get(this._apiUrl + '?module=proxy&action=eth_blockNumber')
    return parseInt(response.result)
  }

  async queryAddress (address) {
    let response = await this.get(this._apiUrl + 'module=account&action=txlist&address=' + address)
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