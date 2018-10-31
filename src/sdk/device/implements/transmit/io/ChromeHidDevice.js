
/** @namespace chrome */
/** @namespace chrome.hid */
/** @namespace chrome.hid.connect */
/** @namespace chrome.hid.onDeviceAdded */
/** @namespace chrome.hid.onDeviceRemoved */
/** @namespace chrome.hid.getDevices */
/** @namespace chrome.runtime.lastError */
/** @namespace chrome.hid.sendFeatureReport */
/** @namespace chrome.hid.receiveFeatureReport */

import D from '../../../../D'
import {Buffer} from 'buffer'

const compatibleDevices = [
  {vid: 0x1ea8, pid: 0xc036}
]

export default class ChromeHidDevice {
  constructor () {
    this._deviceId = null
    this._connectionId = null
    this._listener = null

    if (!chrome || !chrome.hid) {
      console.warn('chrome.hid not in chrome app env, exit')
      return
    }

    let connect = () => {
      chrome.hid.connect(this._deviceId, connection => {
        if (chrome.runtime.lastError) {
          console.warn('chrome.hid.connect error: ' + chrome.runtime.lastError.message)
          this._deviceId = null
          this._listener && D.dispatch(() => this._listener(D.error.deviceConnectFailed, D.status.plugIn))
          return
        }

        this._connectionId = connection.connectionId
        console.log('Connected to the HID device!', this._deviceId, this._connectionId)
        this._listener && D.dispatch(() => this._listener(D.error.succeed, D.status.plugIn))
      })
    }

    chrome.hid.onDeviceAdded.addListener(device => {
      console.log('hid plug in vid=' + device.vendorId + ', pid=' + device.productId)
      if (!compatibleDevices.find(d => d.vid === device.vendorId && d.pid === device.productId)) {
        console.log('hid not compatible device, ignore')
        return
      }
      if (this._deviceId) return
      this._deviceId = device.deviceId
      connect()
    })

    chrome.hid.onDeviceRemoved.addListener(deviceId => {
      console.log('hid plug out', deviceId)
      if (this._deviceId !== deviceId) return
      this._deviceId = null
      this._connectionId = null
      this._listener && D.dispatch(() => this._listener(D.error.succeed, D.status.plugOut))
    })

    chrome.hid.getDevices({}, foundDevices => {
      if (chrome.runtime.lastError) {
        console.warn('chrome.hid.getDevices error: ' + chrome.runtime.lastError.message)
        return
      }

      if (this._deviceId) return
      if (foundDevices.length === 0) return
      let device = foundDevices[0]
      console.log('hid found device: vid=' + device.vendorId + ', pid=' + device.productId)
      if (!compatibleDevices.find(d => d.vid === device.vendorId && d.pid === device.productId)) {
        console.log('hid not compatible device, ignore')
        return
      }
      this._deviceId = device.deviceId
      connect(device)
    })
  }

  send (reportId, command) {
    if (this._deviceId === null || this._connectionId === null) {
      throw D.error.noDevice
    }

    if (typeof command === 'string') {
      command = Buffer.from(command, 'hex')
    }

    console.debug('send package', reportId, command.toString('hex'))
    return new Promise((resolve, reject) => {
      chrome.hid.sendFeatureReport(this._connectionId, reportId, command.buffer, () => {
        if (chrome.runtime.lastError) {
          console.warn('hid send error: ' + chrome.runtime.lastError.message)
          reject(D.error.deviceComm)
        }
        resolve()
      })
    })
  }

  receive () {
    if (this._deviceId === null || this._connectionId === null) {
      throw D.error.noDevice
    }

    return new Promise((resolve, reject) => {
      chrome.hid.receiveFeatureReport(this._connectionId, 51, (data) => {
        if (chrome.runtime.lastError) {
          console.warn('receive error: ' + chrome.runtime.lastError.message)
          reject(D.error.deviceComm)
        }
        data = Buffer.from(data)
        console.debug('receive package', data.toString('hex'))
        resolve(data)
      })
    })
  }

  listenPlug (callback) {
    this._listener = callback
    if (this._deviceId !== null && this._connectionId !== null) {
      D.dispatch(() => this._listener(D.error.succeed, D.status.plugIn))
    }
  }
}
