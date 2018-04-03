

var MY_HID_VENDOR_ID  = 7848;
var MY_HID_PRODUCT_ID = 49189;
// var MY_HID_PRODUCT_ID = 1;
// var MY_HID_VENDOR_ID  = 21324;
var _deviceId = null;
var _connectionHandle = null;
var _sender = null;
var _status = document.getElementById('status');


function arrayBufferToHex(array) {
  var hexchars = '0123456789ABCDEF';
  var hexString = new Array(array.byteLength * 2);
  var intArray = new Uint8Array(array);

  for (var i = 0; i < intArray.byteLength; i++) {
    hexString[2 * i] = hexchars.charAt((intArray[i] >> 4) & 0x0f);
    hexString[2 * i + 1] = hexchars.charAt(intArray[i] & 0x0f);
  }
  return hexString.join('');
}

function hexToArrayBuffer(hex) {
  var result = new ArrayBuffer(hex.length / 2);
  var hexchars = '0123456789ABCDEFabcdef';
  var res = new Uint8Array(result);
  for (var i = 0; i < hex.length; i += 2) {
    if (hexchars.indexOf(hex.substring(i, i + 1)) == -1) break;
    res[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return result;
}

function append(msg) {
  text = document.createElement('p');
  text.append(msg);
  document.body.appendChild(text);
}

function foundDevice(device) {
  if (!_deviceId) {
    _deviceId = device.device;
    _status.innerHTML = 'pluged';
    connect(device);
  }
}

function requestPermission(callback) {
  chrome.permissions.request(
    {permissions: [{'usbDevices': [{"vendorId": MY_HID_VENDOR_ID, "productId": MY_HID_PRODUCT_ID}] }]}
    , function(result) {
    if (result) {
      callback();
    } else {
      console.log('App was not granted the "usbDevices" permission.');
      console.log(chrome.runtime.lastError);
    }
  });
}

function connect(device) {
  chrome.usb.openDevice(device, function(connectionHandle) {
    _connectionHandle = connectionHandle;
    console.log('Connected to the USB device!', _connectionHandle);
    chrome.usb.listInterfaces(_connectionHandle, function(descriptors) {
      for (des of descriptors) {
        console.log('device interface info' + des);
      }
    });

    chrome.usb.claimInterface(_connectionHandle, 0, function() {
      if (chrome.runtime.lastError != undefined) {
        console.warn('chrome.usb.bulkTransfer error: ' + chrome.runtime.lastError.message);
        return;
      }
        console.log("Claimed");
        send(hexToArrayBuffer('0204048033000004bd02000000000000'));
    });
  });
}

function send(data) {
  var transferInfo = {
    direction: 'out',
    requestType: 'class',
    recipient: 'interface',
    request: 0x09,
    // a strange thing: if value=0x03XX, it will be 0x0302 in final usb command. if vlaue!=0x03xx, "no define"
    value: 0x0302,
    index: 0,
    data: data
  };
  chrome.usb.controlTransfer(_connectionHandle, transferInfo, function(info) {
    if (chrome.runtime.lastError != undefined) {
      console.warn('send error: ' + chrome.runtime.lastError.message
        + ' resultCode: ' + info? 'undefined' : info.resultCode);
      return;
    }
    console.log('Sent to the USB device!', _connectionHandle);
    if (info && info.resultCode === 0 && info.data) {
      console.log("send got " + info.data.byteLength + " bytes");
      console.log(arrayBufferToHex(info.data));
      receive();
    }
  });
}

function receive() {
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
  chrome.usb.controlTransfer(_connectionHandle, transferInfo, function(info) {
    if (chrome.runtime.lastError != undefined) {
      console.warn('receive error: ' + chrome.runtime.lastError.message
        + ' resultCode: ' + info.resultCode);
      return;
    }
    console.log('receive from the USB device!', _connectionHandle);
    if (info && info.resultCode === 0 && info.data) {
      console.log("receive got " + info.data.byteLength + " bytes");
      console.log(arrayBufferToHex(info.data));
    }
  });
}

function receive2() {
  var transferInfo = {
    direction: 'in',
    recipient: 'interface',
    requestType: 'standard',
    request: 0x06,
    value: 0x0302,
    index: 0x0409,
    length: 0x0ff
  };
  chrome.usb.controlTransfer(_connectionHandle, transferInfo, function(info) {
    if (chrome.runtime.lastError != undefined) {
      console.warn('receive error: ' + chrome.runtime.lastError.message
        + ' resultCode: ' + info.resultCode);
      return;
    }
    console.log('receive from the USB device!', _connectionHandle);
    if (info && info.resultCode === 0 && info.data) {
      console.log("receive got " + info.data.byteLength + " bytes");
      console.log(arrayBufferToHex(info.data));
    }
  });
}

chrome.usb.getDevices({}, function(foundDevices) {
  if (chrome.runtime.lastError != undefined) {
    console.warn('chrome.usb.getDevices error: ' +
                 chrome.runtime.lastError.message);
    return;
  }

  for (var device of foundDevices) {
      console.log('found device: vid=' + device.vendorId + ', pid=' + device.productId);
    if (device.productId == MY_HID_PRODUCT_ID && device.vendorId == MY_HID_VENDOR_ID) {
      foundDevice(device);
    }
  }
});

chrome.usb.onDeviceAdded.addListener(function(device) {
  console.log('plugin vid=' + device.vendorId + ', pid=' + device.productId);
  if (device.productId == MY_HID_PRODUCT_ID && device.vendorId == MY_HID_VENDOR_ID) {
    foundDevice(device);
  }
});

chrome.usb.onDeviceRemoved.addListener(function(device) {
  console.log('plugout vid=' + device.vendorId + ', pid=' + device.productId);
  if (device.device == _deviceId) {
    _status.innerHTML = 'unpluged';
    _connectionHandle = null;
    _deviceId = null;
  }
});

document.getElementById('button').addEventListener('click', function() {
  chrome.usb.getUserSelectedDevices({
    'multiple': false
  }, function(selected_devices) {
    if (chrome.runtime.lastError != undefined) {
      console.warn('chrome.usb.getUserSelectedDevices error: ' +
                   chrome.runtime.lastError.message);
      return;
    }
    for (var device of selected_devices) {
      console.log('pid=' +  device.productId + ', vid=' + device.vendorId);
    }
  });
});

document.getElementById('button2').addEventListener('click', function() {
  requestPermission(function() {
    console.log('ok!');
    // send(hexToArrayBuffer('0204048033000004bd02000000000000'));
    receive2();
  });
});