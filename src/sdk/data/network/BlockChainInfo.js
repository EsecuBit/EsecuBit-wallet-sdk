
import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

const TEST_URL = 'https://testnet.blockchain.info'
const MAIN_URL = 'https://blockchain.info'

const BlockchainInfo = function (coinType) {
  this._supportMultiAddresses = true
  this.coinType = 'undefined'
  this._blockHeight = -1
  this.coinType = coinType
}

BlockchainInfo.prototype = new ICoinNetwork()
BlockchainInfo.prototype.website = 'blockchain.info'
BlockchainInfo.prototype._apiUrl = 'undefined'

BlockchainInfo.prototype.superInit = BlockchainInfo.prototype.init
BlockchainInfo.prototype.init = async function () {
  await this.superInit(this.coinType)
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

/**
 * @return addressInfo:
 * {
 *    address: string,
 *    txCount: int,
 *    txs: tx array
 * }
 *
 * @see queryTransaction
 *
 */
/**
 *
 * @return tx:
 * {
 *    txId: string,
 *    version: int,
 *    blockNumber: int,
 *    confirmations: int,
 *    lockTime: long
 *    time: long,
 *    hasDetails: bool,   // for queryAddress only, whether the tx has inputs and outputs. e.g. blockchain.info -> true, chain.so -> false
 *    intputs: [{prevAddress, value(bitcoin -> santoshi)}],
 *    outputs: [{address, value(bitcoin -> santoshi)}, index, script]
 * }
 *
 */
BlockchainInfo.prototype.queryAddresses = async function (addresses) {
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
      .map(rTx => wrapTx(rTx))
    addressInfos.push(info)
  }
  return addressInfos
}

function wrapTx (rTx) {
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

BlockchainInfo.prototype.queryTransaction = async function (txId) {
  let response = await this.get([this._apiUrl, 'rawtx', txId].join('/') + '?cors=true')
  return wrapTx(response)
}

BlockchainInfo.prototype.sendTransaction = async function (rawTransaction) {
  console.log('send', rawTransaction)
  let response = await this.post([this._apiUrl, 'pushtx'].join('/'), 'tx=' + rawTransaction)
  // TODO wrap
  return response
}

export default {class: BlockchainInfo}
