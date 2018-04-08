
var D = require('../def');

var MockDevice = function() {
};
module.exports = MockDevice;

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
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer("3141317A5031655035514765666932444D505466544C35534C6D7637446976664E61"));
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