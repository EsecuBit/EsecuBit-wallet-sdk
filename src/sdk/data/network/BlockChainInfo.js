
import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

const TEST_URL = 'https://testnet.blockchain.info'
const MAIN_URL = 'https://blockchain.info'

export default class BlockchainInfo extends ICoinNetwork {
  constructor (coinType) {
    super()
    // noinspection JSUnusedGlobalSymbols
    this._supportMultiAddresses = true
    this.coinType = 'undefined'
    this._blockHeight = -1
    this.coinType = coinType
  }

  async init () {
    await super.init()
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

    let response = await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/'))
    this._blockHeight = parseInt(response)
    return {blockHeight: this._blockHeight}
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
        .map(rTx => BlockchainInfo.wrapTx(rTx))
      addressInfos.push(info)
    }
    return addressInfos
  }

  async queryTransaction (txId) {
    let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true')
    return BlockchainInfo.wrapTx(response)
  }

  async sendTransaction (rawTransaction) {
    console.log('send', rawTransaction)
    let response = await this.post([this._apiUrl, 'pushtx'].join('/'), 'tx=' + rawTransaction)
    // TODO wrap
    return response
  }

  static wrapTx (rTx) {
    let tx = {
      txId: rTx.hash,
      version: rTx.ver,
      blockNumber: rTx.block_height,
      confirmations: rTx.weight,
      lockTime: rTx.lock_time,
      time: rTx.time,
      hasDetails: true
    }
    tx.inputs = rTx.inputs.map(input => {
      return {
        prevAddress: input.prev_out.addr,
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
