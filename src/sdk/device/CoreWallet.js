
import D from '../D'
import MockDevice from './MockDevice'
import ChromeUsbDevice from './ChromeUsbDevice'

export default class CoreWallet {
  constructor () {
    if (CoreWallet.prototype.Instance) {
      return CoreWallet.prototype.Instance
    }
    CoreWallet.prototype.Instance = this

    this._deviceTrue = new ChromeUsbDevice()
    this._device = new MockDevice()
    this._walletId = 'defaultId'
  }

  async init () {
    return {walletId: this._walletId}
  }

  async sync () {
    // TODO get index from device
  }

  async updateIndex (addressInfo) {
  }

  listenPlug (callback) {
    this._deviceTrue.listenPlug(callback)
  }

  async getWalletInfo () {
    let cosVersion = await this._getCosVersion()
    let firmwareVersion = await this._getFirmwareVersion()
    return [
      {name: 'COS Version', value: D.arrayBufferToHex(cosVersion)},
      {name: 'Firmware Version', value: D.arrayBufferToHex(firmwareVersion)}]
  }

  _getFirmwareVersion () {
    return this.sendHexApdu('0003000000')
  }

  _getCosVersion () {
    return this.sendHexApdu('00FF000000')
  }

  async verifyPin () {
    throw D.ERROR_DEVICE_COMM
  }

  async getAddress (addressParams) {
    // TODO fix
    let apdu
    if (addressParams.force === true) {
      apdu = '0023010000'
    } else {
      apdu = '0023000000'
    }
    let response = await this.sendHexApdu(apdu)
    return String.fromCharCode.apply(null, new Uint8Array(response))
  }

  sendHexApdu (apdu) {
    return this._device.sendAndReceive(D.hexToArrayBuffer(apdu))
  }

  sendHexApduTrue (apdu) {
    return this._deviceTrue.sendAndReceive(D.hexToArrayBuffer(apdu))
  }
}
