
/** @namespace chrome */
/** @namespace chrome.usb */
/** @namespace chrome.usb.openDevice */
/** @namespace chrome.usb.onDeviceAdded */
/** @namespace chrome.usb.onDeviceRemoved */
/** @namespace chrome.usb.getDevices */
/** @namespace chrome.runtime.lastError */
/** @namespace chrome.usb.controlTransfer */

import D from '../D'
import IEsDevice from './IEsDevice'

/**
 * @deprecated
 */
export default class ChromeUsbDevice extends IEsDevice {
  constructor () {
    super()
    this._deviceId = null
    this._connectionHandle = null
    this._listener = null

    if (!chrome || !chrome.usb) {
      console.warn('chrome.usb not in chrome app env, exit')
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
        //     if (chrome.runtime.lastError) {
        //       console.warn('chrome.usb.claimInterface error: ' + chrome.runtime.lastError.message)
        //       // if (that._listener !== null) {
        //       //   that._listener(D.error.deviceConnectFailed, true)
        //       // }
        //       // return
        //     }
        //     console.log('Claimed')
        //     that.sendAndReceive(toBuffer('030604803300000ABD080000000000000000000000000000'), function () {
        //
        //     })
        //     if (that._listener !== null) {
        //       that._listener(D.error.succeed, true)
        //     }
        //   })
        // }, 500)

        if (this._listener !== null) {
          this._listener(D.error.succeed, true)
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
            this._listener(D.error.succeed, false)
          }
        }
      }
    })

    chrome.usb.getDevices({}, (foundDevices) => {
      if (chrome.runtime.lastError) {
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

  async sendAndReceive (apdu) {
    if (this._deviceId === null || this._connectionHandle === null) {
      throw D.error.noDevice
    }

    let send = (data) => {
      let packageData = Buffer.alloc(64)

      packageData[0] = 0x21
      packageData[1] = 0x00
      packageData[2] = data.length
      for (let i = 0; i < data.length; i++) {
        packageData[i + 3] = data[i]
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
          if (chrome.runtime.lastError) {
            console.warn('send error: ' + chrome.runtime.lastError.message + ' resultCode: ' + info ? 'undefined' : info.resultCode)
            reject(D.error.deviceComm)
          }
          console.log('Sent to the USB device!', this._connectionHandle)
          if (info.resultCode !== 0) {
            console.warn('send apdu error ', info.resultCode)
            reject(D.error.deviceComm)
          }

          console.log('sent ' + info.data.byteLength + ' bytes')
          resolve()
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
            if (chrome.runtime.lastError) {
              console.warn('receive error: ' + chrome.runtime.lastError.message + ' resultCode: ' + info.resultCode)
              reject(D.error.deviceComm)
            }
            console.log('receive from the USB device!', this._connectionHandle)
            if (info.resultCode !== 0) {
              console.warn('receive apdu error ', info.resultCode)
              reject(D.error.deviceComm)
            }

            let response = Buffer.from(info.data)
            console.log('receive got ' + response.length + ' bytes:')
            console.log(response.toString('hex'))
            resolve(info.data)
          })
        })
      }
      while (true) {
        let data = await transfer()
        if (data[5] === 0x02 && data[6] === 0x00 && data[7] === 0x60) {
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

  listenPlug (callback) {
    this._listener = callback
    if (this._deviceId !== null && this._connectionHandle !== null) {
      callback(D.error.succeed, D.status.plugIn)
    }
  }
}
