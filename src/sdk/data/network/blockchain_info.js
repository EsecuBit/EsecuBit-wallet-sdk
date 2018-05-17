
const CoinNetwork = require('./coin_network').class
const D = require('../../def').class

const TEST_URL = 'https://testnet.blockchain.info'
const MAIN_URL = 'https://blockchain.info'

const BlockchainInfo = function () {
  this.coinType = 'undefined'
  this._blockHeight = -1
}
module.exports = {class: BlockchainInfo}

BlockchainInfo.prototype = new CoinNetwork()
BlockchainInfo.prototype.website = 'blockchain.info'
BlockchainInfo.prototype._apiUrl = 'undefined'

BlockchainInfo.prototype.init = async function (coinType) {
  switch (coinType) {
    case D.COIN_BIT_COIN:
      this._apiUrl = MAIN_URL
      break
    case D.COIN_BIT_COIN_TEST:
      this._apiUrl = TEST_URL
      break
    default:
      throw D.ERROR_NETWORK_COINTYPE_NOT_SUPPORTED
  }
  this.coinType = coinType

  let response = await this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/'))
  this._blockHeight = parseInt(response)
  return {blockHeight: this._blockHeight}
}

BlockchainInfo.prototype.queryAddresses = function (addresses, callback) {
  this.get2(this._apiUrl + '/multiaddr?cors=true&active=' + addresses.join('|'), callback, function (response) {
    // TODO warp response
    callback(D.ERROR_NO_ERROR, response)
  })
}

BlockchainInfo.prototype.queryTransaction = function (txId, callback) {
  this.get2([this._apiUrl, 'get_tx', this._coinTypeStr, txId].join('/'), callback, (response) => {
    let transactionInfo = {
      txId: response.data.txid,
      version: response.data.version,
      blockNumber: response.data.block_no,
      confirmations: response.data.confirmations,
      locktime: response.data.locktime,
      time: response.data.time,
      hasDetails: true
    }
    transactionInfo.inputs = []
    for (let i in response.inputs) {
      if (!response.inputs.hasOwnProperty(i)) {
        continue
      }
      let input = response.inputs[i]
      transactionInfo.inputs.push({
        address: input.address,
        value: D.getFloatFee(that.coinType, input.value)
      })
    }
    transactionInfo.outputs = []
    for (i in response.outputs) {
      if (!response.outputs.hasOwnProperty(i)) {
        continue
      }
      let output = response.outputs[i]
      transactionInfo.outputs.push({
        address: output.address,
        value: D.getFloatFee(that.coinType, output.value),
        index: output.output_no,
        script: output.script_hex
      })
    }
    callback(D.ERROR_NO_ERROR, transactionInfo)
  })
}

BlockchainInfo.prototype.sendTransaction = (rawTransaction, callback) => {
  this.post([this._apiUrl, 'send_tx', this._coinTypeStr].join('/'),
    {tx_hex: rawTransaction},
    callback,
    (response) => {
      callback(D.ERROR_NO_ERROR, response)
    })
}
