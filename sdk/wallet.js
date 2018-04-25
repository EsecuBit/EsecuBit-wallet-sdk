
var D = require('./def');

var Wallet = function () {
    this._device = require('./hardware/core_wallet');
    this._coinData = require('./data/coin_data');
};
module.exports = Wallet;

Wallet.prototype.initWallet = function (callback) {
    var status = 0;
    this._device.init(function (error) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        status++;
    });
    this._coinData.initNetwork(function (error) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        status++;
    });
};

Wallet.prototype.listenDevice = function (callback) {
    this._device.listenPlug(callback);
};

Wallet.prototype.listenTransactionInfo = function (callback) {
    this._coinData.listenTransactionInfo(callback);
};

Wallet.prototype.getAccounts = function (deviceID, passPhraseID, callback) {
    this._coinData.getAccounts(deviceID, passPhraseID, callback);
};

Wallet.prototype.newAccount = function (deviceID, passPhraseID, coinType, callback) {
    this._coinData.newAccount(deviceID, passPhraseID, coinType, callback);
};

Wallet.prototype.getWalletInfo = function (callback) {
    this._device.getWalletInfo(callback);
};

Wallet.prototype.getFee = function(feeType) {
    if (feeType === D.FEE_FAST) {
        return 100000;
    }
    if (feeType === D.FEE_NORMAL) {
        return 50000;
    }
    if (feeType === D.FEE_ECNOMIC) {
        return 20000;
    }
};

Wallet.prototype.getFloatCount = function(floatCount) {
    return floatCount / 100000000;
};