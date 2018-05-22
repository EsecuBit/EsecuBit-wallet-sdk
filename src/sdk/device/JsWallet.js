// powered by bitcoin-js

const D = require('../D').class
const bitcoin = require('bitcoinjs-lib')

// TODO remove when publish
const TEST_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63'

const NETWORK = D.TEST_MODE ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

const JsWallet = function () {
}
module.exports = {instance: new JsWallet()}

JsWallet.prototype.init = function (initSeed) {
  return new Promise(resolve => {
    let seed = TEST_SEED
    if (initSeed) {
      seed = initSeed
    }
    this._root = bitcoin.HDNode.fromSeedHex(seed, NETWORK)
    resolve()
  })
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
 *     prevOutScript: string,
 *   }],
 *   outputs: [{
 *     address: WIF,
 *     value: long
 *   }]
 */
JsWallet.prototype.signTransaction = function (tx) {
  return new Promise((resolve, reject) => {
    try {
      let txb = new bitcoin.TransactionBuilder(NETWORK)
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
      let transaction = txb.build()
      resolve({id: transaction.getId(), hex: transaction.toHex()})
    } catch (e) {
      console.warn(e)
      reject(D.ERROR_UNKNOWN)
    }
  })
}
