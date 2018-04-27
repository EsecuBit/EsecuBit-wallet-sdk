
var D = require('../def').class;
var Device = require('../def').class;

var ADDRESSES = [
    "3141317A5031655035514765666932444D505466544C35534C6D7637446976664E61",
    "31457a3639536e7a7a6d65506d5a58335770457a4d4b54726342463267704e513535",
    "31585054674452684e3852466e7a6e69574364646f624439694b5a617472764834",
    "31347245374a717934613650323771574343736e676b556642787465765a68504842",
    "314d38733253356267417a53537a5654654c377a7275764d504c767a536b45417576"
];

var MockDevice = function() {
    this.currentAddressIndex = 0;
};
module.exports = {class: MockDevice};

MockDevice.prototype = new Device();
MockDevice.prototype.listenPlug = function(callback) {
    setTimeout(function() {
        callback(D.ERROR_NO_ERROR, true);
        // setTimeout(function () {
        //     callback(D.ERROR_NO_ERROR, false);
        // }, 2000);
    }, 500);
};

MockDevice.prototype.sendAndReceive = function(apdu, callback) {
    if (arrayBufferToHex(apdu) === "0003000000") {
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer("010100"));
        return;
    }
    if (arrayBufferToHex(apdu) === "00FF000000") {
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer("010102"));
        return;
    }
    if (arrayBufferToHex(apdu) === "0023000000") {
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer(ADDRESSES[this.currentAddressIndex]));
        return;
    }
    if (arrayBufferToHex(apdu) === "0023010000") {
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer(ADDRESSES[++this.currentAddressIndex % ADDRESSES.length]));
        return;
    }
    callback(D.ERROR_COMM);
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

function hexToArrayBuffer(hex) {
    var result = new ArrayBuffer(hex.length / 2);
    var hexChars = '0123456789ABCDEFabcdef';
    var res = new Uint8Array(result);
    for (var i = 0; i < hex.length; i += 2) {
        if (hexChars.indexOf(hex.substring(i, i + 1)) === -1) break;
        res[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return result;
}