
var D = require('./def');

var Wallet = function () {
    this._device = require('./hardware/core_wallet');
    this._coinData = require('./data/coin_data');
};
module.exports = Wallet;

Wallet.prototype.initWallet = function (callback) {
    this._device.init(callback);
};

Wallet.prototype.recoverWallet = function (callback) {
    this._device.recover(callback);
};

Wallet.prototype.resetWallet = function (callback) {
    this._device.reset(callback);
};

Wallet.prototype.listenDevice = function (callback) {
    this._device.listenPlug(callback);
};

Wallet.prototype.listenTransactionInfo = function (callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Wallet.prototype.requestLogin = function (callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Wallet.prototype.getAccounts = function (deviceID, passPhraseID, callback) {
    this._coinData.loadAccounts(deviceID, passPhraseID, callback);
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