
import * as D from '../def'
import MockDevice from './mock_device'

let CoreWallet = function() {
        // this._device = new EsHidDevice();
        this._device = new MockDevice();
};
export default CoreWallet;

CoreWallet.prototype.hasInitialize = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.listenPlug = function(callback) {
    this._device.listenPlug(callback);
};

CoreWallet.prototype.init = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.recover = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.reset = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.getFirmwareVersion = function(callback) {
    this._device.sendAndReceive(hexToArrayBuffer('0003000000'), function (error, response) {
        if (error !== ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        console.log('get version: ' + arrayBufferToHex(response));
        callback(D.ERROR_NO_ERROR, arrayBufferToHex(response));
    });
};

CoreWallet.prototype.getCosVersion = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.verifyPin = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.getAddress = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.sendApdu = function(apdu, callback) {
    this._device.sendAndReceive(hexToArrayBuffer(apdu), function(error, response) {
        if (error !== ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        callback(D.ERROR_NO_ERROR, arrayBufferToHex(response));
    });
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