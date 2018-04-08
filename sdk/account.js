
var D = require('./def');
var CoreWallet = require('./hardware/core_wallet');

var Account = function(info) {
    this.accountID = info.accountID;
    this.label = info.label;
    this.deviceID = info.deviceID;
    this.passPhraseID = info.passPhraseID;
    this.coinType = info.coinType;
    this._device = CoreWallet.instance;
};
module.exports = Account;

Account.prototype.getTransactionInfos = function(callback) {

};

Account.prototype.getAddress = function(addressParam, callback) {
    this._device.getAddress(addressParam, function (error, address) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        callback(D.ERROR_NO_ERROR, {address: address, qrAddress: 'bitcoin:' + address});
    });
};

Account.prototype.sendBitCoin = function(transaction, callback) {

};