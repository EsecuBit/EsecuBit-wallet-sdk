
/** @namespace chrome */
/** @namespace chrome.usb */
/** @namespace chrome.usb.openDevice */
/** @namespace chrome.usb.onDeviceAdded */
/** @namespace chrome.usb.onDeviceRemoved */
/** @namespace chrome.usb.getDevices */
/** @namespace chrome.runtime.lastError */
/** @namespace chrome.usb.bulkTransfer */
/** @namespace chrome.usb.listInterfaces */
/** @namespace chrome.usb.claimInterface */

import D from '../../../../D'

const openDebugLog = false
const compatibleDevices = [
  {vid: 0x1ea8, pid: 0x800a}
]

export default class ChromeUsbDevice {
  constructor () {
    this._deviceId = null
    this._connectionHandle = null
    this._listener = () => {}

    if (!chrome || !chrome.usb) {
      console.warn('chrome.usb not in chrome app env, exit')
      return
    }

    let connect = (device) => {
      chrome.usb.openDevice(device, (connectionHandle) => {
        this._connectionHandle = connectionHandle
        console.log('Connected to the USB device!', connectionHandle)

        chrome.usb.listInterfaces(connectionHandle, (descriptors) => {
          if (chrome.runtime.lastError) {
            console.warn('chrome.usb.listInterfaces error: ' + chrome.runtime.lastError.message)
            D.dispatch(() => this._listener(D.error.deviceConnectFailed, D.status.plugIn))
            return
          }
          console.log('USB device interface info: ', descriptors)
          if (!descriptors || descriptors.length === 0) {
            console.warn('no descriptors for device')
            D.dispatch(() => this._listener(D.error.deviceConnectFailed, D.status.plugIn))
            return
          }

          let descriptor = descriptors[0]
          this._inEndPoint = descriptor.endpoints.find(ep => ep.direction === 'in')
          this._outEndPoint = descriptor.endpoints.find(ep => ep.direction === 'out')
          chrome.usb.claimInterface(connectionHandle, descriptor.interfaceNumber, () => {
            if (chrome.runtime.lastError) {
              console.warn('chrome.usb.claimInterface error: ' + chrome.runtime.lastError.message)
              D.dispatch(() => this._listener(D.error.deviceConnectFailed, D.status.plugIn))
              return
            }
            console.log('Claimed interface', descriptor)
            D.dispatch(() => this._listener(D.error.succeed, D.status.plugIn))
          })
        })
      })
    }

    chrome.usb.onDeviceAdded.addListener((device) => {
      console.log('usb plug in vid=' + device.vendorId + ', pid=' + device.productId)
      if (!compatibleDevices.find(d => d.vid === device.vendorId && d.pid === device.productId)) {
        console.log('usb not compatible device, ignore')
        return
      }
      if (!this._deviceId) {
        this._deviceId = device.device
        connect(device)
      }
    })

    chrome.usb.onDeviceRemoved.addListener((device) => {
      console.log('usb plug out vid=' + device.vendorId + ', pid=' + device.productId)
      if (device.device === this._deviceId) {
        this._deviceId = null
        this._connectionHandle = null
        D.dispatch(() => this._listener(D.error.succeed, D.status.plugOut))
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
      console.log('usb found device: vid=' + device.vendorId + ', pid=' + device.productId)
      if (!compatibleDevices.find(d => d.vid === device.vendorId && d.pid === device.productId)) {
        console.log('usb not compatible device, ignore')
        return
      }
      this._deviceId = device.device
      connect(device)
    })
  }

  async send (data) {
    if (this._deviceId === null || this._connectionHandle === null) {
      throw D.error.noDevice
    }

    let transferInfo = {
      direction: 'out',
      endpoint: this._outEndPoint.address,
      data: data
    }
    openDebugLog && console.debug('send package', transferInfo.endpoint, data.toString('hex'))

    return new Promise((resolve, reject) => {
      chrome.usb.bulkTransfer(this._connectionHandle, transferInfo, (info) => {
        if (chrome.runtime.lastError) {
          console.warn('send error: ', chrome.runtime.lastError, info)
          reject(D.error.deviceComm)
          return
        }
        if (info.resultCode !== 0) {
          console.warn('send apdu error ', info)
          reject(D.error.deviceComm)
          return
        }
        resolve()
      })
    })
  }

  async receive () {
    let transferInfo = {
      direction: 'in',
      endpoint: this._inEndPoint.address,
      length: 0xFFFF
    }
    return new Promise((resolve, reject) => {
      chrome.usb.bulkTransfer(this._connectionHandle, transferInfo, (info) => {
        if (chrome.runtime.lastError) {
          console.warn('receive error: ' + chrome.runtime.lastError.message + ' resultCode: ' + info.resultCode)
          reject(D.error.deviceComm)
        }
        if (info.resultCode !== 0) {
          console.warn('receive apdu error ', info.resultCode)
          reject(D.error.deviceComm)
        }

        let data = Buffer.from(info.data)
        openDebugLog && console.debug('receive package', transferInfo.endpoint, data.toString('hex'))
        resolve(data)
      })
    })
  }

  listenPlug (callback) {
    this._listener = callback || this._listener
    if (this._deviceId !== null && this._connectionHandle !== null) {
      callback(D.error.succeed, D.status.plugIn)
    }
  }
}
