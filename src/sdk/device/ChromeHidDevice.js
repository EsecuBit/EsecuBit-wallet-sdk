
/** @namespace chrome */
/** @namespace chrome.hid */
/** @namespace chrome.hid.connect */
/** @namespace chrome.hid.onDeviceAdded */
/** @namespace chrome.hid.onDeviceRemoved */
/** @namespace chrome.hid.getDevices */
/** @namespace chrome.runtime.lastError */
/** @namespace chrome.hid.sendFeatureReport */
/** @namespace chrome.hid.receiveFeatureReport */

import D from '../D'
import IEsDevice from './IEsDevice'

export default class ChromeHidDevice extends IEsDevice {
  constructor () {
    super()
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
        console.log('Connected to the USB device!', this._deviceId, this._connectionId)
        this._listener && D.dispatch(() => this._listener(D.error.succeed, D.status.plugIn))
      })
    }

    chrome.hid.onDeviceAdded.addListener(device => {
      console.log('plug in vid=' + device.vendorId + ', pid=' + device.productId)
      if (this._deviceId) return
      this._deviceId = device.deviceId
      connect()
    })

    chrome.hid.onDeviceRemoved.addListener(device => {
      console.log('plug out', device)
      if (device.deviceId === this._deviceId) {
        this._deviceId = null
        this._connectionId = null
        this._listener && D.dispatch(() => this._listener(D.error.succeed, D.status.plugOut))
      }
    })

    chrome.hid.getDevices({}, foundDevices => {
      if (chrome.runtime.lastError) {
        console.warn('chrome.hid.getDevices error: ' + chrome.runtime.lastError.message)
        return
      }

      if (this._deviceId) return
      if (foundDevices.length === 0) return
      let device = foundDevices[0]
      console.log('found device: vid=' + device.vendorId + ', pid=' + device.productId)
      this._deviceId = device.deviceId
      connect(device)
    })
  }

  async sendAndReceive (reportId, pack) {
    if (this._deviceId === null || this._connectionId === null) {
      throw D.error.noDevice
    }

    if (typeof pack === 'string') {
      pack = D.toBuffer(pack)
    }

    let send = (reportId, command) => {
      return new Promise((resolve, reject) => {
        chrome.hid.sendFeatureReport(this._connectionId, reportId, command, () => {
          if (chrome.runtime.lastError) {
            console.warn('hid send error: ' + chrome.runtime.lastError.message)
            reject(D.error.deviceComm)
          }
          resolve()
        })
      })
    }
    let receive = async () => {
      return new Promise((resolve, reject) => {
        chrome.hid.receiveFeatureReport(this._connectionId, 51, (data) => {
          if (chrome.runtime.lastError) {
            console.warn('receive error: ' + chrome.runtime.lastError.message)
            reject(D.error.deviceComm)
          }
          resolve(data)
        })
      })
    }

    await send(reportId, pack)
    return receive()
  }

  listenPlug (callback) {
    this._listener = callback
    if (this._deviceId !== null && this._connectionId !== null) {
      D.dispatch(() => this._listener(D.error.succeed, D.status.plugIn))
    }
  }
}
