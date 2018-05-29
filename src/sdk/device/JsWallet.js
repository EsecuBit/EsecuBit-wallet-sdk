// powered by bitcoin-js

import D from '../D'
import bitcoin from 'bitcoinjs-lib'

// TODO remove when publish
const TEST_SYNC_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63'
const TEST_TRANSACTION_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'

const NETWORK = D.TEST_MODE ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

export default class JsWallet {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this

    this._walletId = D.TEST_WALLET_ID
  }

  init (initSeed) {
    const DEFAULT_SEED = D.TEST_SYNC ? TEST_SYNC_SEED : TEST_TRANSACTION_SEED
    let seed = initSeed || DEFAULT_SEED
    this._root = bitcoin.HDNode.fromSeedHex(seed, NETWORK)

    return {walletId: this._walletId}
  }

  async sync () {
  }

  async updateIndex (addressInfo) {
  }

  async listenPlug (callback) {
    callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
  }

  static async getWalletInfo () {
    return [
      {name: 'COS Version', value: 1},
      {name: 'Firmware Version', value: 1}]
  }

  async _derive (path, pPublicKey) {
    try {
      // TODO change to bip32 package implement
      let node = this._root
      path = path.toString()
      if (pPublicKey) {
        const ECPair = bitcoin.ECPair
        const HDNode = bitcoin.HDNode
        let ecurve = require('ecurve')
        let curve = ecurve.getCurveByName('secp256k1')
        let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.hexToArrayBuffer(pPublicKey.publicKey)))
        let pChainCode = Buffer.from(D.hexToArrayBuffer(pPublicKey.chainCode))
        let keyPair = new ECPair(null, Q, {network: NETWORK})
        node = new HDNode(keyPair, pChainCode)
      }
      return node.derivePath(path)
    } catch (e) {
      console.warn(e)
      throw D.ERROR_UNKNOWN
    }
  }

  async getPublicKey (publicKeyPath, pPublicKey) {
    let node = await this._derive(publicKeyPath, pPublicKey)
    let publicKey = D.arrayBufferToHex(node.getPublicKeyBuffer())
    let chainCode = D.arrayBufferToHex(node.chainCode)
    return {publicKey, chainCode}
  }

  async getAddress (addressPath, pPublicKey) {
    let node = await this._derive(addressPath, pPublicKey)
    return node.getAddress()
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
  async signTransaction (tx) {
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
}