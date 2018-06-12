// powered by btc-js and web3

import ecurve from 'ecurve'
import bitcoin from 'bitcoinjs-lib'
import web3 from 'web3'
import D from '../D'

export default class JsWallet {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this
  }

  init (initSeed) {
    const network = D.test.mode ? bitcoin.networks.testnet : bitcoin.networks.btc
    const defaultSeed = D.test.sync ? D.test.syncSeed : D.test.txSeed
    const walletId = D.test.sync ? D.test.syncWalletId : D.test.txWalletId

    let seed = initSeed || defaultSeed
    this.network = network
    this._root = bitcoin.HDNode.fromSeedHex(seed, network)
    console.log('seed', seed)
    console.log('walletId', walletId)
    return {walletId: walletId}
  }

  async sync () {
  }

  async updateIndex (addressInfo) {
  }

  async listenPlug (callback) {
    callback(D.error.succeed, D.status.plugIn)
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
        let keyPair = new ECPair(null, Q, {network: this.network})
        node = new HDNode(keyPair, pChainCode)
      }
      return node.derivePath(path)
    } catch (e) {
      console.warn(e)
      throw D.error.unknown
    }
  }

  async getPublicKey (publicKeyPath, pPublicKey) {
    let node = await this._derive(publicKeyPath, pPublicKey)
    let publicKey = D.arrayBufferToHex(node.getPublicKeyBuffer())
    let chainCode = D.arrayBufferToHex(node.chainCode)
    return {publicKey, chainCode}
  }

  async getAddress (coinType, addressPath, pPublicKey) {
    let btc = async () => {
      let node = await this._derive(addressPath, pPublicKey)
      return node.getAddress()
    }

    let eth = async () => {
      let node = await this._derive(addressPath, pPublicKey)
      let uncompressedPublicKey = node.keyPair.Q.getEncoded(false)
      let withoutHead = new Uint8Array(D.hexToArrayBuffer(D.arrayBufferToHex(uncompressedPublicKey).slice(2)))
      // noinspection JSCheckFunctionSignatures
      let hash = web3.utils.keccak256(withoutHead)
      return '0x' + hash.slice(-40)
    }

    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return btc()
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        return eth()
      default:
        throw D.error.coinNotSupported
    }
  }

  async publicKeyToAddress (publicKey) {
    const ECPair = bitcoin.ECPair
    let curve = ecurve.getCurveByName('secp256k1')
    let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.hexToArrayBuffer(publicKey)))
    let keyPair = new ECPair(null, Q, {network: this.network})
    return keyPair.getAddress()
  }

  /**
   * tx:
   * btc:
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
    let btc = () => {
      try {
        let txb = new bitcoin.TransactionBuilder(this.network)
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
        throw D.error.unknown
      }
    }

    let eth = () => {
      // TODO finish
      throw D.error.notImplemented
    }

    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return btc()
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        return eth()
      default:
        console.log('2')
        throw D.error.coinNotSupported
    }
  }
}
