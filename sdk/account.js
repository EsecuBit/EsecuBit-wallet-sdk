
var D = require('./def');

var Account = function(info) {
    this.info = info;
    this.accountID = info.accountID;
    this.label = info.label;
    this.deviceID = info.deviceID;
    this.passPhraseID = info.passPhraseID;
    this.coinType = info.coinType;
    this._device = require('./hardware/core_wallet');
    // TODO fix circle require
    this._coinData = require('./data/coin_data');
};
module.exports = Account;

Account.prototype.getTransactionInfos = function(startIndex, endIndex, callback) {
    this._coinData.getTransactionInfos(this.accountID, startIndex, endIndex, callback);
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