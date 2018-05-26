// powered by bitcoin-js

const D = require('../D').class
const bitcoin = require('bitcoinjs-lib')

// TODO remove when publish
const TEST_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63'

const NETWORK = D.TEST_MODE ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

const JsWallet = function () {
  this._walletId = D.TEST_WALLET_ID
}
module.exports = {instance: new JsWallet()}

JsWallet.prototype.init = async function (initSeed) {
  let seed = initSeed || TEST_SEED
  this._root = bitcoin.HDNode.fromSeedHex(seed, NETWORK)

  return {walletId: this._walletId}
}

JsWallet.prototype.sync = async function () {
}

JsWallet.prototype.updateIndex = async function (addressInfo) {
}

JsWallet.prototype.listenPlug = async function (callback) {
  callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
}

JsWallet.prototype.getWalletInfo = async function () {
  return [
    {name: 'COS Version', value: 1},
    {name: 'Firmware Version', value: 1}]
}

JsWallet.prototype.getPublicKey = async function (publicKeyPath, pPublicKey) {
  try {
    let node = this._root
    if (pPublicKey) {
      const ECPair = bitcoin.ECPair
      const HDNode = bitcoin.HDNode
      let ecurve = require('ecurve')
      let curve = ecurve.getCurveByName('secp256k1')
      let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.hexToArrayBuffer(pPublicKey.publicKey)))
      let pChainCode = Buffer.from(D.hexToArrayBuffer(pPublicKey.chainCode))
      let keyPair = new ECPair(null, Q, null)
      node = new HDNode(keyPair, pChainCode)
    }
    let childNode = node.derivePath(publicKeyPath)
    let publicKey = D.arrayBufferToHex(childNode.getPublicKeyBuffer())
    let chainCode = D.arrayBufferToHex(childNode.chainCode)
    return {publicKey, chainCode}
  } catch (e) {
    console.warn(e)
    throw D.ERROR_UNKNOWN
  }
}

JsWallet.prototype.getAddress = async function (addressPath) {
  try {
    return this._root.derivePath(addressPath).getAddress()
  } catch (e) {
    console.warn(e)
    throw D.ERROR_UNKNOWN
  }
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
JsWallet.prototype.signTransaction = async function (tx) {
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
    return {id: transaction.getId(), hex: transaction.toHex()}
  } catch (e) {
    console.warn(e)
    throw D.ERROR_UNKNOWN
  }
}
