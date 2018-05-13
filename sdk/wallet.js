
var D = require('./def').class;

var EsWallet = function () {
    this._device = require('./hardware/core_wallet').instance;
    this._coinData = require('./data/coin_data').instance;
};
module.exports = {class: EsWallet};

EsWallet.prototype.initWallet = function (callback) {
    var status = 0;
    this._device.init(function (error) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        status++;
    });
    this._coinData.init(function (error) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        status++;
    });
};

EsWallet.prototype.listenDevice = function (callback) {
    this._device.listenPlug(callback);
};

EsWallet.prototype.listenTransactionInfo = function (callback) {
    this._coinData.listenTransactionInfo(callback);
};

EsWallet.prototype.getAccounts = function (deviceID, passPhraseID, callback) {
    this._coinData.getAccounts(deviceID, passPhraseID, callback);
};

EsWallet.prototype.newAccount = function (deviceID, passPhraseID, coinType, callback) {
    this._coinData.newAccount(deviceID, passPhraseID, coinType, callback);
};

EsWallet.prototype.getWalletInfo = function (callback) {
    this._device.getWalletInfo(callback);
};

EsWallet.prototype.getFee = function(feeType, callback) {
    // var transactionSize = 180 * ins + 34 * outs + 10
    this._coinData.getSuggestedFee(feeType, function(error, fee) {
        callback();
    });
};

EsWallet.prototype.getFloatCount = function(floatCount) {
    return floatCount / 100000000;
};