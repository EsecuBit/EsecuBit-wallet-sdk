

import CoreWallet from 'hardware/core_wallet'
import CoinData from 'sdk/data/coin_data'

let Wallet = function () {
    this._device = new CoreWallet();
    this._coinData = new CoinData();
};
export default Wallet;

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

Wallet.prototype.getWalletInfo = function (callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};