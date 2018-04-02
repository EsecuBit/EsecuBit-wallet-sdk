var MockDevice = function() {
};

MockDevice.prototype = new Device();

MockDevice.prototype.listenPlug = function(callback) {
    setTimeout(function() {
        callback(ERROR_NO_ERROR, true);
        // setTimeout(function () {
        //     callback(ERROR_NO_ERROR, false);
        // }, 2000);
    },2000);
};

MockDevice.prototype.sendAndReceive = function(apdu, callback) {
    if (arrayBufferToHex(apdu) === "0003000000") {
        callback(ERROR_NO_ERROR, hexToArrayBuffer("0100010001009000"));
        return;
    }
    callback(ERROR_NO_ERROR, apdu);
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