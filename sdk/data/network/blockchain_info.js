
// LIMITS: Accounced 5 requests/second, actually < 0.5 requets/second when keep running. Get 429 http error returned when exceed

/**
 *
 * request: address
 * response:
 * {
 * "status" : "success",
 * "data" : {
 *     "network" : "BTC",
 *     "address" : "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX",
 *     "balance" : "18.27406441",
 *     "received_value" : "29677.07906441",
 *      "pending_value" : "0.00000000",
 *      "total_txs" : 1255,
 *      "txs" : [
 *      {
 *          "txid" : "134fadd9bd1031afd8b67e6ab5c82bc03499b5505235c49a43181a98cc975974",
 *          "block_no" : 519886,
 *          "confirmations" : 101,
 *          "time" : 1524672174,
 *          "incoming" : {
 *              "output_no" : 4,
 *              "value" : "0.00011300",
 *              "spent" : null,
 *              "inputs" : [
 *                  {
 *                      "input_no" : 0,
 *                      "address" : "1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw",
 *                      "received_from" : {
 *                          "txid" : "f76486ee6bd8a8c3084119353a368152d8904a5e3cb82aad7d14fbd0df0912d5",
 *                          "output_no" : 35
 *                      }
 *                  }
 *              ],
 *              "req_sigs" : 1,
 *              "script_asm" : "OP_DUP OP_HASH160 99bc78ba577a95a11f1a344d4d2ae55f2f857b98 OP_EQUALVERIFY OP_CHECKSIG",
 *              "script_hex" : "76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac"
 *          }
 *      },
 *      ...]
 * }
 * }
 */

var CoinNetwork = require('./coin_network').class;
var D = require('../../def').class;

// TODO test
var BlockchainInfo = function() {
    this.coinType = 'undefined';
    this._blockHeight = -1;
};
module.exports = {class: BlockchainInfo};

BlockchainInfo.prototype = new CoinNetwork();
BlockchainInfo.prototype.website = 'blockchain.info';
BlockchainInfo.prototype._apiUrl = 'https://blockchain.info';

BlockchainInfo.prototype.init = function (coinType, callback) {
    this.coinType = coinType;

    this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/'), callback, function (response) {
        this._blockHeight = parseInt(response);
        callback(D.ERROR_NO_ERROR, {blockHeight: this._blockHeight});
    });
};

BlockchainInfo.prototype.queryAddress = function (address, callback) {
    // TODO test
    this.get(this._apiUrl + '/multiaddr?cors=true&active=' + address, callback, function (response) {
        callback(D.ERROR_NO_ERROR, response[0]);
    });
};

BlockchainInfo.prototype.queryTransaction = function (txId, callback) {
    var that = this;
    this.get([this._apiUrl, 'get_tx', this._coinTypeStr, txId].join('/'), callback, function (response) {
        var transactionInfo =  {
            txId: response.data.txid,
            version: response.data.version,
            blockNumber: response.data.block_no,
            confirmations: response.data.confirmations,
            locktime: response.data.locktime,
            time: response.data.time,
            hasDetails: true
        };
        transactionInfo.inputs = [];
        for (var i in response.inputs) {
            if (!response.inputs.hasOwnProperty(i)) {
                continue;
            }
            var input = response.inputs[i];
            transactionInfo.inputs.push({
                address: input.address,
                value: D.getFloatFee(that.coinType, input.value)
            });
        }
        transactionInfo.outputs = [];
        for (i in response.outputs) {
            if (!response.outputs.hasOwnProperty(i)) {
                continue;
            }
            var output = response.outputs[i];
            transactionInfo.outputs.push({
                address: output.address,
                value: D.getFloatFee(that.coinType, output.value),
                index: output.output_no,
                script: output.script_hex
            });
        }
        callback(D.ERROR_NO_ERROR, transactionInfo);
    });
};

BlockchainInfo.prototype.sendTransaction = function (rawTransaction, callback) {
    this.post([this._apiUrl, 'send_tx', this._coinTypeStr].join('/'),
        {tx_hex: rawTransaction},
        callback, function (response) {
        callback(D.ERROR_NO_ERROR, response);
    });
};