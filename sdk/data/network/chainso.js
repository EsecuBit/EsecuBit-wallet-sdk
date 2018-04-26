
// LIMITS: 5 requests/second, get 429 http error returned when exceed

var CoinNetwork = require('./coin_network');
var D = require('../../def');

var ChainSo = function() {
    this.coinType = 'undefined';
    this._coinTypeStr = 'undefined';
    this.coinInfo = null;
};
module.exports = ChainSo;

ChainSo.prototype = new CoinNetwork();
var superClass = ChainSo.prototype;
ChainSo.prototype.type = 'chainso';
ChainSo.prototype.website = 'chain.so';
ChainSo.prototype._apiUrl = 'https://chain.so/api/v2';

var superGet = superClass.get;
ChainSo.prototype.get = function(url, errorCallback, callback) {
    superGet(url, errorCallback, function(response) {
        if (response.status !== 'success') {
            console.warn('chainso request failed', url, response);
            errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
            return;
        }
        callback(response.data);
    });
};

ChainSo.prototype.initNetwork = function (coinType, callback) {
    this.coinType = coinType;
    switch (coinType) {
        case D.COIN_BIT_COIN:
            this._coinTypeStr = 'BTC';
            break;
        case D.COIN_BIT_COIN_TEST:
            this._coinTypeStr = 'BTCTEST';
            break;
        default:
            callback(D.ERROR_NETWORK_COINTYPE_NOT_SUPPORTED);
            return;
    }

    var that = this;
    this.get([this._apiUrl, "get_info", this._coinTypeStr].join('/'), callback, function (response) {
        callback(D.ERROR_NO_ERROR, response);
    });
};

ChainSo.prototype.queryAddress = function (address, callback) {
    this.get([this._apiUrl, 'address', this._coinTypeStr, address].join('/'), callback, function (response) {
        callback(D.ERROR_NO_ERROR, response);
    });
};

ChainSo.prototype.queryTransaction = function (txId, callback) {
    this.get([this._apiUrl, 'get_tx', this._coinTypeStr, txId].join('/'), callback, function (response) {
        callback(D.ERROR_NO_ERROR, response);
    });
};

ChainSo.prototype.sendTransaction = function (rawTransaction, callback) {
    this.post([this._apiUrl, 'send_tx', this._coinTypeStr].join('/'),
        {tx_hex: rawTransaction},
        callback, function (response) {
        callback(D.ERROR_NO_ERROR, response);
    });
};