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
    const btcNetwork = D.test.mode ? bitcoin.networks.testnet : bitcoin.networks.btc
    const defaultSeed = D.test.sync ? D.test.syncSeed : D.test.txSeed
    const walletId = D.test.sync ? D.test.syncWalletId : D.test.txWalletId

    let seed = initSeed || defaultSeed
    this.btcNetwork = btcNetwork
    this._root = bitcoin.HDNode.fromSeedHex(seed, btcNetwork)
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
        let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.toBuffer(pPublicKey.publicKey)))
        let pChainCode = Buffer.from(D.toBuffer(pPublicKey.chainCode))
        let keyPair = new ECPair(null, Q, {network: this.btcNetwork})
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
    let publicKey = D.toHex(node.getPublicKeyBuffer())
    let chainCode = D.toHex(node.chainCode)
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
      let withoutHead = new Uint8Array(D.toBuffer(D.toHex(uncompressedPublicKey).slice(2)))
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
    let Q = ecurve.Point.decodeFrom(curve, Buffer.from(D.toBuffer(publicKey)))
    let keyPair = new ECPair(null, Q, {network: this.btcNetwork})
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
   *     index: number,
   *     script: string,
   *   }],
   *   outputs: [{
   *     address: base58 string,
   *     value: number
   *   }]
   * }
   *
   * eth:
   * [nonce, gasprice, startgas, to, value, data, r, s, v]
   * {
   *   input: {
   *     address: 0x string,
   *     path: string,
   *   ],
   *   output: {
   *     address: 0x string,
   *     value: number
   *   },
   *   nonce: number,
   *   gasPrice: number,
   *   startGas: number,
   *   data: hex string,
   * }
   */
  async signTransaction (coinType, tx) {
    let btc = () => {
      try {
        let txb = new bitcoin.TransactionBuilder(this.btcNetwork)
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
      const chainIds = {}
      chainIds[D.coin.main.eth] = 1
      chainIds[D.coin.test.ethRinkeby] = 4
      let chainId = chainIds[coinType]
      if (!chainId) throw D.error.coinNotSupported
      let unsignedTx = [tx.nonce, tx.gasPrice, tx.startGas, tx.output.address, tx.output.value, tx.data, chainId * 2 + 35, 0, 0]
      // sign
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
        throw D.error.coinNotSupported
    }
  }
}
