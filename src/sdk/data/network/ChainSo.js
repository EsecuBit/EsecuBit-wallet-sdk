
// LIMITS: Accounced 5 requests/second, actually < 0.5 requets/second when keep running. Get 429 http error returned when exceed

/**
 *
 * request: address
 * response:
 * {
 * "status" : "success",
 * "data" : {
 *   "network" : "BTC",
 *   "address" : "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX",
 *   "balance" : "18.27406441",
 *   "received_value" : "29677.07906441",
 *    "pending_value" : "0.00000000",
 *    "total_txs" : 1255,
 *    "txs" : [
 *    {
 *      "txid" : "134fadd9bd1031afd8b67e6ab5c82bc03499b5505235c49a43181a98cc975974",
 *      "block_no" : 519886,
 *      "confirmations" : 101,
 *      "time" : 1524672174,
 *      "incoming" : {
 *        "output_no" : 4,
 *        "value" : "0.00011300",
 *        "spent" : null,
 *        "inputs" : [
 *          {
 *            "input_no" : 0,
 *            "address" : "1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw",
 *            "received_from" : {
 *              "txid" : "f76486ee6bd8a8c3084119353a368152d8904a5e3cb82aad7d14fbd0df0912d5",
 *              "output_no" : 35
 *            }
 *          }
 *        ],
 *        "req_sigs" : 1,
 *        "script_asm" : "OP_DUP OP_HASH160 99bc78ba577a95a11f1a344d4d2ae55f2f857b98 OP_EQUALVERIFY OP_CHECKSIG",
 *        "script_hex" : "76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac"
 *      }
 *    },
 *    ...]
 * }
 * }
 */

import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

export default class ChainSo extends ICoinNetwork {
  constructor (coinType) {
    super()
    this.coinType = coinType
    this._coinTypeStr = null
    this._apiUrl = 'https://chain.so/api/v2'
  }

  async get (url) {
    let response = await super.get(url)
    if (response.status !== 'success') {
      console.warn('chainso request failed', url, response)
      throw D.ERROR_NETWORK_PROVIDER_ERROR
    }
    return response.data
  }

  async init () {
    await super.init()
    switch (this.coinType) {
      case D.COIN_BIT_COIN:
        this._coinTypeStr = 'BTC'
        break
      case D.COIN_BIT_COIN_TEST:
        this._coinTypeStr = 'BTCTEST'
        break
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }

    // TODO slow down the request speed
    // this.get([this._apiUrl, 'get_info', this._coinTypeStr].join('/'), callback, function (response) {
    //   callback(D.ERROR_NO_ERROR, response)
    // })
  }

  async queryAddress (address) {
    let addressInfo = await this.get([this._apiUrl, 'address', this._coinTypeStr, address].join('/'))
    // TODO wrap
    return addressInfo
  }

  async queryTx (txId) {
    let response = await this.get([this._apiUrl, 'get_tx', this._coinTypeStr, txId].join('/'))
    let txInfo = {
      txId: response.txid,
      version: response.version,
      blockNumber: response.block_no,
      confirmations: response.confirmations,
      time: response.time,
      hasDetails: true
    }
    txInfo.inputs = []
    for (let input of response.inputs) {
      txInfo.inputs.push({
        prevAddress: input.address,
        value: D.convertValue(this.coinType, input.value, D.UNIT_BTC, D.UNIT_BTC_SANTOSHI)
      })
    }
    txInfo.outputs = []
    for (let output of response.outputs) {
      txInfo.outputs.push({
        address: output.address,
        value: D.convertValue(this.coinType, output.value, D.UNIT_BTC, D.UNIT_BTC_SANTOSHI),
        index: output.output_no,
        script: output.script_hex
      })
    }
    return txInfo
  }

  async sendTx (rawTransaction) {
    let response = await this.post([this._apiUrl, 'send_tx', this._coinTypeStr].join('/'), {tx_hex: rawTransaction})
    // TODO wrap
    return response
  }
}
ChainSo.provider = 'chain.so'
