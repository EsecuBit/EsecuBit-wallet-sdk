// powered by bitcoin-js

const D = require('../D').class
const bitcoin = require('bitcoinjs-lib')

const TEST_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63'

const JsWallet = function () {
  this._root = bitcoin.HDNode.fromSeedHex(TEST_SEED)
}
module.exports = {instance: new JsWallet()}

JsWallet.prototype.init = function () {
  return D.wait(0)
}

JsWallet.prototype.listenPlug = function (callback) {
  this._deviceTrue.listenPlug(callback)
}

JsWallet.prototype.getWalletInfo = async function () {
  await D.wait(0)
  return [
    {name: 'COS Version', value: 1},
    {name: 'Firmware Version', value: 1}]
}

JsWallet.prototype.getPublicKey = function (addressPath) {
  return 0
}

JsWallet.prototype.getAddress = function (addressPath) {
  return new Promise((resolve, reject) => {
    try {
      resolve(this._root.derivePath(addressPath).getAddress())
    } catch (e) {
      console.warn(e)
      reject(D.ERROR_UNKNOWN)
    }
  })
}

/**
 * tx:
 * {
 *   inputs: [{
 *     prevAddress: WIF,
 *     prevAddressPath: string,
 *     prevTxId: hex string,
 *     prevOutIndex: int,
 *   }],
 *   outputs: [{
 *     address: WIF,
 *     value: long
 *   }]
 */
JsWallet.prototype.signTransaction = function (tx) {
  return new Promise((resolve, reject) => {
    try {
      let txb = new bitcoin.TransactionBuilder()
      txb.setVersion(1)
      for (let input of tx.inputs) {
        txb.addInput(input.prevTxId, input.prevOutIndex)
      }
      for (let output of tx.outputs) {
        txb.addOutput(output.address, output.value)
      }
      let i = 0
      for (let input of tx.inputs) {
        let key = this._root.derivePath(input.prevAddressPath)
        txb.sign(i, key)
        i++
      }
      resolve(txb.build().toHex())
    } catch (e) {
      console.warn(e)
      reject(D.ERROR_UNKNOWN)
    }
  })
}

JsWallet.prototype.sendHexApdu = function (apdu) {
  return this._device.sendAndReceive(D.hexToArrayBuffer(apdu))
}

JsWallet.prototype.sendHexApduTrue = function (apdu) {
  return this._deviceTrue.sendAndReceive(D.hexToArrayBuffer(apdu))
}
