
const D = require('../D').class
const MockDevice = require('./MockDevice').class
const EsHidDevice = require('./EsHidDevice').class

const CoreWallet = function () {
  this._deviceTrue = new EsHidDevice()
  this._device = new MockDevice()
}
module.exports = {instance: new CoreWallet()}

CoreWallet.prototype.init = async function () {
}

CoreWallet.prototype.sync = async function () {
}

CoreWallet.prototype.listenPlug = function (callback) {
  this._deviceTrue.listenPlug(callback)
}

CoreWallet.prototype.getWalletInfo = async function () {
  let cosVersion = await this._getCosVersion()
  let firmwareVersion = await this._getFirmwareVersion()
  return [
    {name: 'COS Version', value: D.arrayBufferToHex(cosVersion)},
    {name: 'Firmware Version', value: D.arrayBufferToHex(firmwareVersion)}]
}

CoreWallet.prototype._getFirmwareVersion = function () {
  return this.sendHexApdu('0003000000')
}

CoreWallet.prototype._getCosVersion = function () {
  return this.sendHexApdu('00FF000000')
}

CoreWallet.prototype.verifyPin = async function () {
  throw D.ERROR_DEVICE_COMM
}

CoreWallet.prototype.getAddress = async function (addressParams) {
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

CoreWallet.prototype.sendHexApdu = function (apdu) {
  return this._device.sendAndReceive(D.hexToArrayBuffer(apdu))
}

CoreWallet.prototype.sendHexApduTrue = function (apdu) {
  return this._deviceTrue.sendAndReceive(D.hexToArrayBuffer(apdu))
}
