// powered by bitcoin-js and web3

import ecurve from 'ecurve'
import bitcoin from 'bitcoinjs-lib'
import web3 from 'web3'
import D from '../D'

const NETWORK = D.TEST_MODE ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

export default class JsWallet {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this
  }

  init (initSeed) {
    const DEFAULT_SEED = D.TEST_SYNC ? D.TEST_SYNC_SEED : D.TEST_TRANSACTION_SEED
    const WALLET_ID = D.TEST_SYNC ? D.TEST_SYNC_WALLET_ID : D.TEST_TRANSACTION_WALLET_ID
    let seed = initSeed || DEFAULT_SEED
    this._root = bitcoin.HDNode.fromSeedHex(seed, NETWORK)

    console.log('seed', seed)
    console.log('walletId', WALLET_ID)
    return {walletId: WALLET_ID}
  }

  async sync () {
  }

  async updateIndex (addressInfo) {
  }

  async listenPlug (callback) {
    callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
  }

  async getWalletInfo () {
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

  async getAddress (coinType, addressPath, pPublicKey) {
    let bBitcoin = async () => {
      let node = await this._derive(addressPath, pPublicKey)
      return node.getAddress()
    }

    let ethereum = async () => {
      let node = await this._derive(addressPath, pPublicKey)
      let uncompressedPublicKey = node.keyPair.Q.getEncoded(false)
      let withoutHead = new Uint8Array(D.hexToArrayBuffer(D.arrayBufferToHex(uncompressedPublicKey).slice(2)))
      // noinspection JSCheckFunctionSignatures
      let hash = web3.utils.keccak256(withoutHead)
      return '0x' + hash.slice(-40)
    }

    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return bBitcoin()
      case D.COIN_ETH:
      case D.COIN_ETH_TEST_RINKEBY:
        return ethereum()
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  }

  async publicKeyToAddress (publicKey) {
    const ECPair = bitcoin.ECPair
    let curve = ecurve.getCurveByName('secp256k1')
    let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.hexToArrayBuffer(publicKey)))
    let keyPair = new ECPair(null, Q, {network: NETWORK})
    return keyPair.getAddress()
  }

  /**
   * tx:
   * bitcoin:
   * {
   *   inputs: [{
   *     address: base58 string,
   *     path: string,
   *     txId: hex string,
   *     index: int,
   *     script: string,
   *   }],
   *   outputs: [{
   *     address: base58 string,
   *     value: long
   *   }]
   *
   * eth:
   * // TODO finish
   */
  async signTransaction (coinType, tx) {
    let bBitcoin = () => {
      try {
        let txb = new bitcoin.TransactionBuilder(NETWORK)
        txb.setVersion(1)
        for (let input of tx.inputs) {
          txb.addInput(input.txId, input.index)
        }
        for (let output of tx.outputs) {
          txb.addOutput(output.address, output.value)
        }
        let i = 0
        for (let input of tx.inputs) {
          let key = this._root.derivePath(input.path)
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

    let ethereum = () => {
      // TODO finish
      throw D.ERROR_NOT_IMPLEMENTED
    }

    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return bBitcoin()
      case D.COIN_ETH:
      case D.COIN_ETH_TEST_RINKEBY:
        return ethereum()
      default:
        console.log('2')
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  }
}
