
var D = require('../def');
var MockDevice = require('./mock_device');

var CoreWallet = function() {
        // this._device = new EsHidDevice();
        this._device = new MockDevice();
};
CoreWallet.instance = new CoreWallet();
module.exports = CoreWallet;

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
    this.sendApdu(hexToArrayBuffer('0003000000'), function (error, response) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        console.log('get firmware version: ' + response);
        callback(D.ERROR_NO_ERROR, response);
    });
};

CoreWallet.prototype.getCosVersion = function(callback) {
    this.sendApdu(hexToArrayBuffer('00FF000000'), function (error, response) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        console.log('get cos version: ' + response);
        callback(D.ERROR_NO_ERROR, response);
    });
};

CoreWallet.prototype.verifyPin = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoreWallet.prototype.getAddress = function(addressParams, callback) {
    // TODO fix
    this.sendApdu("0012000000", function (error, response) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        console.log('response: ' + response);
        var address = String.fromCharCode.apply(null, new Uint8Array(hexToArrayBuffer(response)));
        console.log('address: ' + address);
        callback(D.ERROR_NO_ERROR, address);
    });
};

CoreWallet.prototype.sendApdu = function(apdu, callback) {
    this._device.sendAndReceive(hexToArrayBuffer(apdu), function(error, response) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        callback(D.ERROR_NO_ERROR, arrayBufferToHex(response));
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