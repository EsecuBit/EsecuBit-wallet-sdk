
import D from '../D'
import ChromeHidDevice from './ChromeHidDevice'
import EsTransmitter from './EsTransmitter'

export default class CoreWallet {
  constructor () {
    if (CoreWallet.prototype.Instance) {
      return CoreWallet.prototype.Instance
    }
    CoreWallet.prototype.Instance = this

    this._device = new ChromeHidDevice()
    this._transmitter = new EsTransmitter(this._device)
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
    this._device.listenPlug(callback)
  }

  async getWalletInfo () {
    let cosVersion = await this._getCosVersion()
    let firmwareVersion = await this._getFirmwareVersion()
    return [
      {name: 'COS Version', value: D.toHex(cosVersion)},
      {name: 'Firmware Version', value: D.toHex(firmwareVersion)}]
  }

  _getFirmwareVersion () {
    return this._sendApdu('0003000000')
  }

  _getCosVersion () {
    return this._sendApdu('00FF000000')
  }

  async verifyPin () {
    throw D.error.deviceComm
  }

  async getAddress (addressParams) {
    let apdu
    if (addressParams.force === true) {
      apdu = '0023010000'
    } else {
      apdu = '0023000000'
    }
    let response = await this._sendApdu(apdu)
    return String.fromCharCode.apply(null, new Uint8Array(response))
  }

  _sendApdu (apdu) {
    return this._transmitter.sendApdu(apdu)
  }

  async getRandom (length) {
    let apdu = '0084000008'
    return this._transmitter.sendApdu(apdu)
  }
}
