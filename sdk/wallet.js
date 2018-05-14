
var D = require('./def').class;

var EsWallet = function () {
    this._device = require('./hardware/core_wallet').instance;
    this._coinData = require('./data/coin_data').instance;
};
module.exports = {class: EsWallet};

EsWallet.prototype._init = function (callback) {
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

EsWallet.prototype._release = function () {
    this._coinData.release();
};

EsWallet.prototype.listenDevice = function (callback) {
    var that = this;
    this._device.listenPlug(function (error, isPluged) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error, isPluged);
            return;
        }
        if (isPluged) {
            that._init(function (error) {
                callback(error, isPluged);
            });
        } else {
            that._release();
        }
    });
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

EsWallet.prototype.getSuggestedFee = function(transaction, coinType, feeType, callback) {
    // TODO move to account
    // var transactionSize = 180 * ins + 34 * outs + 10
};

EsWallet.prototype.getFloatFee = function(coinType, fee) {
    return this._coinData.getFloatFee(coinType, fee);
};