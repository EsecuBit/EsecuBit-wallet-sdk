
var Wallet = function() {
    this._device = new CoreWallet();
    this._coinData = new CoinData();
};

Wallet.prototype.initWallet = function(callback) {
    this._device.init(callback);
};

Wallet.prototype.recoverWallet = function(callback) {
    this._device.recover(callback);
};

Wallet.prototype.resetWallet = function(callback) {
    this._device.reset(callback);
};

Wallet.prototype.listenDevice = function(callback) {
    this._device.listenPlug(callback);
};

Wallet.prototype.listenTransactionInfo = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Wallet.prototype.requestLogin = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Wallet.prototype.getAccounts = function(deviceID, passPhraseID, callback) {
    this._coinData.loadAccounts(deviceID, passPhraseID, callback);
};

Wallet.prototype.getWalletInfo = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};