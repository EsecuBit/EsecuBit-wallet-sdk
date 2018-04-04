
let Account = function(label, deviceID, passPhraseID, coinType) {
    // accountID init by db
    this.accountID = '0';
    this.label = label;
    this.deviceID = deviceID;
    this.passPhraseID = passPhraseID;
    this.coinType = coinType;

};
export default Account;

Account.prototype.getTransactionInfos = function(callback) {

};

Account.prototype.getAddress = function(addressParam, callback) {

};

Account.prototype.sendBitCoin = function(transaction, callback) {

};