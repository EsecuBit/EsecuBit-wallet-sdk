
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
    var total = transaction.out + transaction.fee;
    var totalString = total / 100000000 + ' BTC';
    var apdu = "0306048033000000";
    console.log(apdu);
    apdu += totalString.length + totalString;
    console.log(apdu);
    apdu += 1;
    console.log(apdu);
    apdu += transaction.addresses[0].length + transaction.addresses[0];
    console.log(apdu);
    apdu[7] = 0x30 + (apdu.length - 8);
    console.log(apdu);
    var padding = apdu.length % 8;
    while (padding > 0) {
        apdu += 0;
        padding--;
    }
    console.log(apdu);
    this._device.sendHexApdu(apdu, callback);
};