
var D = require('./def');

var Account = function(info) {
    this.info = info;
    this.accountID = info.accountID;
    this.label = info.label;
    this.deviceID = info.deviceID;
    this.passPhraseID = info.passPhraseID;
    this.coinType = info.coinType;
    this.balance = info.hasOwnProperty('balance')? 0 : info.balance;

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
    var enc = new TextEncoder();
    console.dir(enc);

    var total = transaction.out + transaction.fee;
    var totalString = total / 100000000 + ' BTC';
    var apdu = "00DD000000";
    console.log(apdu);
    apdu += totalString.length + arrayBufferToHex(enc.encode(totalString));
    console.log(apdu);
    apdu += "01";
    console.log(apdu);
    var hexChars = '0123456789ABCDEF';
    apdu += hexChars[transaction.addresses[0].length >> 8] + hexChars[transaction.addresses[0].length % 0x10] + arrayBufferToHex(enc.encode(transaction.addresses[0]));
    console.log(apdu);
    apdu[4] = 0x30 + (apdu.length - 5);
    console.log(apdu);
    var padding = apdu.length % 8;
    while (padding > 0) {
        apdu += 0;
        padding--;
    }
    console.log(apdu);

    var ok = "007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138";
    this._device.sendHexApdu(ok, function (error, result) {
        var data = new Uint8Array(result);
        var intArray = new Uint8Array(new Array(2));
        var paddingLength = data[1];
        intArray[0] = data[3];
        intArray[1] = data[4];
        console.log('sw ' + arrayBufferToHex(intArray));
        var sw = arrayBufferToHex(intArray);
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