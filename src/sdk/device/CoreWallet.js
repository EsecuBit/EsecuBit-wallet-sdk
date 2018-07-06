
import D from '../D'
import ChromeHidDevice from './ChromeHidDevice'
import MockDevice from './MockDevice'
import EsTransmitter from './EsTransmitter'

export default class CoreWallet {
  constructor () {
    if (CoreWallet.prototype.Instance) {
      return CoreWallet.prototype.Instance
    }
    CoreWallet.prototype.Instance = this

    this._device = D.test.mockDevice ? new MockDevice() : new ChromeHidDevice()
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

  async getAddress (coinType, path, isShowing) {
    let copy = D.buffer.copy
    // bit 0: 0 not save on key / 1 save on key
    // bit 1: 0 not show on key / 1 show on key
    // bit 2: 0 public key / 1 address
    // if bit2 == 0, bit0 == bit1 == 0
    let flag = isShowing ? 0x07 : 0x04
    let apdu = new Uint8Array(26)
    copy('803D00001505', 0, apdu, 0)
    apdu[3] = flag
    path.split('/').forEach((index, i) => {
      if (i === 0 && index === 'm') return
      let indexInt = 0
      if (index[index.length - 1] === "'") {
        indexInt += 0x80000000
        index = index.slice(0, -1)
      }
      indexInt += parseInt(index)
      console.log('aaaa', indexInt.toString(16), i)
      apdu[6 + 4 * (i - 1)] = indexInt >> 24
      apdu[6 + 4 * (i - 1) + 1] = indexInt >> 16
      apdu[6 + 4 * (i - 1) + 2] = indexInt >> 8
      apdu[6 + 4 * (i - 1) + 3] = indexInt
    })
    console.log(D.toHex(apdu))

    let response = await this._sendApdu(apdu.buffer)
    return String.fromCharCode.apply(null, new Uint8Array(response))
  }

  async getRandom (length) {
    if (length > 255) throw D.error.notImplemented
    let apdu = '00840000' + (length >> 8) + (length % 0xFF)
    return this._transmitter.sendApdu(apdu)
  }

  _sendApdu (apdu, isEnc) {
    return this._transmitter.sendApdu(apdu, isEnc)
  }
}
