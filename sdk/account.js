
var Account = function(label, deviceID, passPhraseID, coinType) {
    // accountID init by db
    this.accountID = "";
    this.label = label;
    this.deviceID = deviceID;
    this.passPhraseID = passPhraseID;
    this.coinType = coinType;

};

Account.prototype.getTransactionInfos = function(callback) {

};

Account.prototype.getAddress = function(addressParam, callback) {

};

Account.prototype.sendBitCoin = function(transaction, callback) {

};