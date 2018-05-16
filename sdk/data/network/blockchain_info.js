

var CoinNetwork = require('./coin_network').class;
var D = require('../../def').class;

var TEST_URL = 'https://testnet.blockchain.info';
var MAIN_URL = 'https://blockchain.info';

var BlockchainInfo = function() {
    this.coinType = 'undefined';
    this._blockHeight = -1;
};
module.exports = {class: BlockchainInfo};

BlockchainInfo.prototype = new CoinNetwork();
BlockchainInfo.prototype.website = 'blockchain.info';
BlockchainInfo.prototype._apiUrl = 'undefined';

BlockchainInfo.prototype.init = function (coinType, callback) {
    switch (coinType) {
        case D.COIN_BIT_COIN:
            this._apiUrl = MAIN_URL;
            break;
        case D.COIN_BIT_COIN_TEST:
            this._apiUrl = TEST_URL;
            break;
        default:
            callback(D.ERROR_NETWORK_COINTYPE_NOT_SUPPORTED);
            return;
    }
    this.coinType = coinType;

    this.get([this._apiUrl, 'q', 'getblockcount?cors=true'].join('/'), callback, function (response) {
        this._blockHeight = parseInt(response);
        callback(D.ERROR_NO_ERROR, {blockHeight: this._blockHeight});
    });
};

BlockchainInfo.prototype.queryAddresses = function (addresses, callback) {
    this.get(this._apiUrl + '/multiaddr?cors=true&active=' + addresses.join('|'), callback, function (response) {
        // TODO warp response
        callback(D.ERROR_NO_ERROR, response);
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