
import * as D from '../def'

let MockDevice = function() {
};
export default MockDevice;

MockDevice.prototype.listenPlug = function(callback) {
    setTimeout(function() {
        callback(D.ERROR_NO_ERROR, true);
        // setTimeout(function () {
        //     callback(D.ERROR_NO_ERROR, false);
        // }, 2000);
    },2000);
};

MockDevice.prototype.sendAndReceive = function(apdu, callback) {
    if (arrayBufferToHex(apdu) === "0003000000") {
        callback(D.ERROR_NO_ERROR, hexToArrayBuffer("0100010001009000"));
        return;
    }
    callback(D.ERROR_NO_ERROR, apdu);
};


function arrayBufferToHex(array) {
    let hexChars = '0123456789ABCDEF';
    let hexString = new Array(array.byteLength * 2);
    let intArray = new Uint8Array(array);

    for (let i = 0; i < intArray.byteLength; i++) {
        hexString[2 * i] = hexChars.charAt((intArray[i] >> 4) & 0x0f);
        hexString[2 * i + 1] = hexChars.charAt(intArray[i] & 0x0f);
    }
    return hexString.join('');
}

function hexToArrayBuffer(hex) {
    let result = new ArrayBuffer(hex.length / 2);
    let hexChars = '0123456789ABCDEFabcdef';
    let res = new Uint8Array(result);
    for (let i = 0; i < hex.length; i += 2) {
        if (hexChars.indexOf(hex.substring(i, i + 1)) === -1) break;
        res[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return result;
}