
var D = require('../def');

var MY_HID_VENDOR_ID  = 7848; // 0x1EA8
var MY_HID_PRODUCT_ID = 49153; // 0xC001

var EsHidDevice = function() {
    this._deviceId = null;
    this._connectionHandle = null;
    this._listener = null;

    var that = this;
    function connect(device) {
        chrome.usb.openDevice(device, function(connectionHandle) {
            that._connectionHandle = connectionHandle;
            console.log('Connected to the USB device!', connectionHandle);

            // chrome.usb.listInterfaces(connectionHandle, function(descriptors) {
            //     console.log(chrome.usb);
            //     console.log(chrome.hid);
            //     for (var des in descriptors) {
            //         console.log('device interface info: ');
            //         console.dir(descriptors[des]);
            //     }
            //
            //     that.sendAndReceive(hexToArrayBuffer('803300000ABD080000000000000000'), function () {
            //
            //     });
            //     if (that._listener !== null) {
            //         that._listener(D.ERROR_NO_ERROR, true);
            //     }
            // });
            //
            // chrome.usb.claimInterface(connectionHandle, 0, function() {
            //     if (chrome.runtime.lastError !== undefined) {
            //         console.warn('chrome.usb.claimInterface error: ' + chrome.runtime.lastError.message);
            //         if (that._listener !== null) {
            //             that._listener(D.ERROR_CONNECT_FAILED, true);
            //         }
            //         return;
            //     }
            //     console.log("Claimed");
            //     that.sendAndReceive(hexToArrayBuffer('803300000ABD080000000000000000'), function () {
            //
            //     });
            //     if (that._listener !== null) {
            //         that._listener(D.ERROR_NO_ERROR, true);
            //     }
            // });

            if (that._listener !== null) {
                that._listener(D.ERROR_NO_ERROR, true);
            }
        });
    }

    chrome.usb.onDeviceAdded.addListener(function(device) {
        console.log('plug in vid=' + device.vendorId + ', pid=' + device.productId);
        if (device.productId === MY_HID_PRODUCT_ID && device.vendorId === MY_HID_VENDOR_ID) {
            if (!that._deviceId) {
                that._deviceId = device.device;
                connect(device);
            }
        }
    });

    chrome.usb.onDeviceRemoved.addListener(function(device) {
        console.log('plug out vid=' + device.vendorId + ', pid=' + device.productId);
        if (device.device === that._deviceId) {
            that._deviceId = null;
            if (that._listener !== null) {
                if (that._listener !== null) {
                    that._listener(D.ERROR_NO_ERROR, false);
                }
            }
        }
    });

    chrome.usb.getDevices({}, function(foundDevices) {
        if (chrome.runtime.lastError !== undefined) {
            console.warn('chrome.usb.getDevices error: ' +
                chrome.runtime.lastError.message);
            return;
        }

        console.log(foundDevices.length);
        for (var index in foundDevices) {
            if (!foundDevices.hasOwnProperty(index)) {
                continue;
            }
            var device = foundDevices[index];
            console.log('found device: vid=' + device.vendorId + ', pid=' + device.productId);
            if (device.productId === MY_HID_PRODUCT_ID && device.vendorId === MY_HID_VENDOR_ID) {
                connect(device);
            }
        }
    });
};
module.exports = EsHidDevice;

EsHidDevice.prototype.sendAndReceive = function (apdu, callback) {
    var that = this;
    // if (!this.isPlugedIn) {
    //     callback(D.ERROR_NO_DEVICE);
    //     return;
    // }

    console.log(that._connectionHandle);
    var send = function(data, callback) {
        var transferInfo = {
            direction: 'out',
            requestType: 'class',
            recipient: 'interface',
            request: 0x09,
            // a strange thing: if value=0x03XX, it will be 0x0302 in final usb command. if value!=0x03xx, "no define"
            value: 0x0302,
            index: 0,
            data: data
        };

        chrome.usb.controlTransfer(that._connectionHandle, transferInfo, function(info) {
            if (chrome.runtime.lastError !== undefined) {
                console.warn('send error: ' + chrome.runtime.lastError.message
                + ' resultCode: ' + info? 'undefined' : info.resultCode);
                return;
            }
            console.log('Sent to the USB device!', that._connectionHandle);
            if (!info) {
                callback(D.ERROR_UNKNOWN);
                return;
            }
            if (info.resultCode !== 0) {
                console.warn("send apdu error ", info.resultCode);
                callback(D.ERROR_COMM);
                return;
            }

            console.log("send got " + info.data.byteLength + " bytes:");
            console.log(arrayBufferToHex(info.data));
            receive(callback);
        });
    };

    var receive = function(callback) {
        var transferInfo = {
            direction: 'in',
            requestType: 'class',
            recipient: 'interface',
            request: 0x01,
            // it can only be 0x0302, otherwise "Transfer failed.", no usb command sent.
            value: 0x0302,
            index: 0,
            length: 0x0010
        };
        // var transferInfo = {
        //   "direction": "in",
        //   "recipient": "interface",
        //     "requestType": "standard",
        //     "request": 0x06,
        //     "value": 0x2200,
        //     "index": 0,
        //     "length": 0x183
        // };
        chrome.usb.controlTransfer(that._connectionHandle, transferInfo, function(info) {
            if (chrome.runtime.lastError !== undefined) {
                console.warn('receive error: ' + chrome.runtime.lastError.message
                    + ' resultCode: ' + info.resultCode);
                return;
            }
            console.log('receive from the USB device!', that._connectionHandle);
            if (!info) {
                callback(D.ERROR_UNKNOWN);
                return;
            }
            if (info.resultCode !== 0) {
                console.warn("receive apdu error ", info.resultCode);
                callback(D.ERROR_COMM);
                return;
            }

            console.log("receive got " + info.data.byteLength + " bytes:");
            console.log(arrayBufferToHex(info.data));
            callback(D.ERROR_NO_ERROR, info.data);
        });
    };

    send(apdu, callback);
};

EsHidDevice.prototype.listenPlug = function(callback) {
    this._listener = callback;
    if (this._deviceId !== null) {
        callback(D.ERROR_NO_ERROR, true);
        return;
    }
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