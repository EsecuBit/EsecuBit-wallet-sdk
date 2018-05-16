
var D = require('./def').class;

var EsAccount = function(info) {
    this.info = info;
    this.accountId = info.accountId;
    this.label = info.label;
    this.deviceId = info.deviceId;
    this.passPhraseId = info.passPhraseId;
    this.coinType = info.coinType;
    this.balance = info.balance;

    this._device = require('./hardware/core_wallet').instance;
    // TODO fix circle require
    this._coinData = require('./data/coin_data').instance;
};
module.exports = {class: EsAccount};

EsAccount.prototype.getTransactionInfos = function(startIndex, endIndex, callback) {
    this._coinData.getTransactionInfos({
        accountId: this.accountId,
        startIndex: startIndex,
        endIndex: endIndex
    }, callback);
};

EsAccount.prototype.getAddress = function(addressParam, callback) {
    this._device.getAddress(addressParam, function (error, address) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        callback(D.ERROR_NO_ERROR, {address: address, qrAddress: 'bitcoin:' + address});
    });
};

EsAccount.prototype.sendBitCoin = function(transaction, callback) {
    var that = this;
    var enc = new TextEncoder();
    console.dir(enc);

    var total = transaction.out + transaction.fee;
    var totalString = this._coinData.getFloatFee(total) + ' BTC';
    var apdu = "";
    var hexChars = '0123456789ABCDEF';
    apdu += hexChars[totalString.length >> 4] + hexChars[totalString.length % 0x10] + arrayBufferToHex(enc.encode(totalString));
    console.log(apdu);
    apdu += "01";
    console.log(apdu);
    apdu += hexChars[transaction.addresses[0].length >> 4] + hexChars[transaction.addresses[0].length % 0x10] + arrayBufferToHex(enc.encode(transaction.addresses[0]));
    console.log(apdu);
    apdu = hexChars[parseInt(apdu.length / 2) % 0x10] + apdu;
    apdu = hexChars[parseInt(apdu.length / 2) >> 4] + apdu;
    apdu = "00780000" + apdu;
    console.log(apdu);

    // var ok = "007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138";
    this._device.sendHexApduTrue(apdu, callback, function (error, result) {
        var data = new Uint8Array(result);
        var intArray = new Uint8Array(new Array(2));
        intArray[0] = data[3];
        intArray[1] = data[4];
        console.log('data ' + arrayBufferToHex(result));
        console.log('data ' + arrayBufferToHex(data));
        console.log('sw ' + arrayBufferToHex(intArray));
        var sw = arrayBufferToHex(intArray);

        if (sw === '6FFA') {
            that.sendBitCoin(transaction, callback);
        }
        callback(sw === '9000'? D.ERROR_NO_ERROR : D.ERROR_USER_CANCEL);
    });
};


function arrayBufferToHex(array) {
    var hexChars = '0123456789ABCDEF';
    var hexString = new Array(array.byteLength * 2);
    var intArray = new Uint8Array(array);

    for (var i = 0; i < intArray.byteLength; i++) {
        hexString[2 * i] = hexChars.charAt((intArray[i] >> 4) & 0x0f);
        hexString[2 * i + 1] = hexChars.charAt(intArray[i] & 0x0f);
    }
    return hexString.join('');
}