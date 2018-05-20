
/** @namespace chrome */
/** @namespace chrome.usb */
/** @namespace chrome.usb.openDevice */
/** @namespace chrome.usb.onDeviceAdded */
/** @namespace chrome.usb.onDeviceRemoved */
/** @namespace chrome.usb.getDevices */
/** @namespace chrome.runtime.lastError */
/** @namespace chrome.usb.controlTransfer */

const D = require('../D').class
const Device = require('./IEsDevice').class

// TODO ask level 3 path publickey to get multi level 5 address
const EsHidDevice = function() {
  this._deviceId = null
  this._connectionHandle = null
  this._listener = null

  if (chrome === undefined || chrome.usb === undefined) {
    console.warn('EsHidDevice not in chrome app env, exit')
    return
  }

  let connect = (device) => {
    chrome.usb.openDevice(device, (connectionHandle) => {
      this._connectionHandle = connectionHandle
      console.log('Connected to the USB device!', connectionHandle)

      // setTimeout(function () {
      //   chrome.usb.listInterfaces(connectionHandle, function(descriptors) {
      //     for (var des in descriptors) {
      //       console.log('device interface info: ')
      //       console.dir(descriptors[des])
      //     }
      //   })
      //
      //   chrome.usb.claimInterface(connectionHandle, 0, function() {
      //     if (chrome.runtime.lastError !== undefined) {
      //       console.warn('chrome.usb.claimInterface error: ' + chrome.runtime.lastError.message)
      //       // if (that._listener !== null) {
      //       //   that._listener(D.ERROR_DEVICE_CONNECT_FAILED, true)
      //       // }
      //       // return
      //     }
      //     console.log('Claimed')
      //     that.sendAndReceive(hexToArrayBuffer('030604803300000ABD080000000000000000000000000000'), function () {
      //
      //     })
      //     if (that._listener !== null) {
      //       that._listener(D.ERROR_NO_ERROR, true)
      //     }
      //   })
      // }, 500)

      if (this._listener !== null) {
        this._listener(D.ERROR_NO_ERROR, true)
      }
    })
  }

  chrome.usb.onDeviceAdded.addListener((device) => {
    console.log('plug in vid=' + device.vendorId + ', pid=' + device.productId)
    if (!this._deviceId) {
      this._deviceId = device.device
      connect(device)
    }
  })

  chrome.usb.onDeviceRemoved.addListener((device) => {
    console.log('plug out vid=' + device.vendorId + ', pid=' + device.productId)
    if (device.device === this._deviceId) {
      this._deviceId = null
      this._connectionHandle = null
      if (this._listener !== null) {
        if (this._listener !== null) {
          this._listener(D.ERROR_NO_ERROR, false)
        }
      }
    }
  })

  chrome.usb.getDevices({}, (foundDevices) => {
    if (chrome.runtime.lastError !== undefined) {
      console.warn('chrome.usb.getDevices error: ' + chrome.runtime.lastError.message)
      return
    }

    if (this._deviceId) {
      return
    }
    if (foundDevices.length === 0) {
      return
    }
    let device = foundDevices[0]
    console.log('found device: vid=' + device.vendorId + ', pid=' + device.productId)
    this._deviceId = device.device
    connect(device)
  })
}
module.exports = {class: EsHidDevice}

EsHidDevice.prototype = new Device()

EsHidDevice.prototype.sendAndReceive = async function (apdu) {
  if (this._deviceId === null || this._connectionHandle === null) {
    D.wait(0)
    throw D.ERROR_NO_DEVICE
  }

  let send = (data) => {
    let packageData = new Uint8Array(new Array(64))
    let intData = new Uint8Array(data)

    packageData[0] = 0x21
    packageData[1] = 0x00
    packageData[2] = intData.byteLength
    for (let i = 0; i < intData.byteLength; i++) {
      packageData[i + 3] = intData[i]
    }

    let transferInfo = {
      direction: 'out',
      requestType: 'class',
      recipient: 'interface',
      request: 0x09,
      // a strange thing: if value=0x03XX, it will be 0x0302 in final usb command. if value!=0x03xx, 'no define'
      value: 0x0302,
      index: 0,
      data: packageData
    }
    return new Promise((resolve, reject) => {
      chrome.usb.controlTransfer(this._connectionHandle, transferInfo, (info) => {
        if (chrome.runtime.lastError !== undefined) {
          console.warn('send error: ' + chrome.runtime.lastError.message + ' resultCode: ' + info ? 'undefined' : info.resultCode)
          reject(D.ERROR_DEVICE_COMM)
        }
        console.log('Sent to the USB device!', this._connectionHandle)
        if (info.resultCode !== 0) {
          console.warn('send apdu error ', info.resultCode)
          reject(D.ERROR_DEVICE_COMM)
        }

        console.log('send got ' + info.data.byteLength + ' bytes:')
        console.log(D.arrayBufferToHex(info.data))
        resolve()
        // for (i = 0; i < 64; i++) {
        //   package[i] = 0
        // }
        // package[0] = 0x21
        // package[1] = 0xC3
        // package[2] = 0x00
        // package[5] = 0x02
        // package[7] = 0x60
        // package[28] = 0xB0
        // package[29] = 0x04
        //
        // chrome.usb.controlTransfer(that._connectionHandle, transferInfo, function(info) {
        //   if (chrome.runtime.lastError !== undefined) {
        //     console.warn('send error: ' + chrome.runtime.lastError.message
        //     + ' resultCode: ' + info? 'undefined' : info.resultCode)
        //     return
        //   }
        //   console.log('Sent to the USB device!', that._connectionHandle)
        //   if (!info) {
        //     callback(D.ERROR_UNKNOWN)
        //     return
        //   }
        //   if (info.resultCode !== 0) {
        //     console.warn('send apdu error ', info.resultCode)
        //     callback(D.ERROR_DEVICE_COMM)
        //     return
        //   }
        //
        //   console.log('send got ' + info.data.byteLength + ' bytes:')
        //   console.log(arrayBufferToHex(info.data))
        //   receive(callback)
        // })
      })
    })
  }

  // TODO test long apdu and long response
  let receive = async () => {
    let transferInfo = {
      direction: 'in',
      requestType: 'class',
      recipient: 'interface',
      request: 0x01,
      // it can only be 0x0302, otherwise 'Transfer failed.', no usb command sent.
      value: 0x0302,
      index: 0,
      length: 0x40
    }
    // var transferInfo = {
    //   'direction': 'in',
    //   'recipient': 'interface',
    //   'requestType': 'standard',
    //   'request': 0x06,
    //   'value': 0x2200,
    //   'index': 0,
    //   'length': 0x183
    // }
    let transfer = () => {
      return new Promise((resolve, reject) => {
        chrome.usb.controlTransfer(this._connectionHandle, transferInfo, (info) => {
          if (chrome.runtime.lastError !== undefined) {
            console.warn('receive error: ' + chrome.runtime.lastError.message + ' resultCode: ' + info.resultCode)
            reject(D.ERROR_DEVICE_COMM)
          }
          console.log('receive from the USB device!', this._connectionHandle)
          if (info.resultCode !== 0) {
            console.warn('receive apdu error ', info.resultCode)
            reject(D.ERROR_DEVICE_COMM)
          }

          console.log('receive got ' + info.data.byteLength + ' bytes:')
          console.log(D.arrayBufferToHex(info.data))
          resolve(info.data)
        })
      })
    }
    while (true) {
      let data = await transfer()
      let intData = new Uint8Array(data)
      if (intData[5] === 0x02 && intData[6] === 0x00 && intData[7] === 0x60) {
        // busy, keep receiving
        continue
      }
      // TODO receive multi package data
      return data
    }
  }

  await send(apdu)
  return receive()
}

EsHidDevice.prototype.listenPlug = function (callback) {
  this._listener = callback
  if (this._deviceId !== null && this._connectionHandle !== null) {
    callback(D.ERROR_NO_ERROR, true)
  }
}