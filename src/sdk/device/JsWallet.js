// powered by btc-js and web3

import ecurve from 'ecurve'
import bitcoin from 'bitcoinjs-lib'
import BigInteger from 'bigi'
import createHmac from 'create-hmac'
import Web3 from 'web3'
import rlp from 'rlp'
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
      let hash = Web3.utils.keccak256(withoutHead)
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
   * [nonce, gasprice, startgas, to, value, data, v, r, s]
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
  signTransaction (coinType, tx) {
    let signBtc = async () => {
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

    let signEth = async () => {
      const chainIds = {}
      chainIds[D.coin.main.eth] = 1
      chainIds[D.coin.test.ethRinkeby] = 4
      let chainId = chainIds[coinType]
      if (!chainId) throw D.error.coinNotSupported

      let unsignedTx = [tx.nonce, tx.gasPrice, tx.startGas, tx.output.address, tx.output.value, tx.data, chainId, 0, 0]
      let rlpUnsignedTx = rlp.encode(unsignedTx)
      // noinspection JSCheckFunctionSignatures
      let rlpHash = Web3.utils.keccak256(rlpUnsignedTx)
      console.log('rlpHash', rlpHash)
      let node = await this._derive(tx.input.path)

      // copy from ecdsa.sign(hash, d) in bitcoinjs, returing [v, r, s] format
      let sign = (hash, d) => {
        const secp256k1 = ecurve.getCurveByName('secp256k1')
        const N_OVER_TWO = secp256k1.n.shiftRight(1)
        let x = d.toBuffer(32)
        let e = BigInteger.fromBuffer(hash)
        let n = secp256k1.n
        let G = secp256k1.G

        let deterministicGenerateK = (hash, x, checkSig) => {
          const ZERO = Buffer.alloc(1, 0)
          const ONE = Buffer.alloc(1, 1)

          // Step A, ignored as hash already provided
          // Step B
          // Step C
          let k = Buffer.alloc(32, 0)
          let v = Buffer.alloc(32, 1)

          // Step D
          k = createHmac('sha256', k)
            .update(v)
            .update(ZERO)
            .update(x)
            .update(hash)
            .digest()

          // Step E
          v = createHmac('sha256', k).update(v).digest()

          // Step F
          k = createHmac('sha256', k)
            .update(v)
            .update(ONE)
            .update(x)
            .update(hash)
            .digest()

          // Step G
          v = createHmac('sha256', k).update(v).digest()

          // Step H1/H2a, ignored as tlen === qlen (256 bit)
          // Step H2b
          v = createHmac('sha256', k).update(v).digest()

          let T = BigInteger.fromBuffer(v)

          // Step H3, repeat until T is within the interval [1, n - 1] and is suitable for ECDSA
          while (T.signum() <= 0 || T.compareTo(secp256k1.n) >= 0 || !checkSig(T)) {
            k = createHmac('sha256', k)
              .update(v)
              .update(ZERO)
              .digest()

            v = createHmac('sha256', k).update(v).digest()

            // Step H1/H2a, again, ignored as tlen === qlen (256 bit)
            // Step H2b again
            v = createHmac('sha256', k).update(v).digest()
            T = BigInteger.fromBuffer(v)
          }

          return T
        }

        let r, s, odd
        deterministicGenerateK(hash, x, (k) => {
          let Q = G.multiply(k)

          if (secp256k1.isInfinity(Q)) return false

          r = Q.affineX.mod(n)
          odd = Q.affineY.mod(BigInteger.fromHex('02')).intValue()
          if (r.signum() === 0) return false

          s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n)
          // noinspection RedundantIfStatementJS
          if (s.signum() === 0) return false

          if (s.compareTo(N_OVER_TWO) > 0) {
            s = n.subtract(s)
            odd = odd ? 0 : 1
          }

          return true
        })
        let v = chainId * 2 + 35 + odd
        return [
          v,
          '0x' + r.toHex(),
          '0x' + s.toHex()
        ]
      }
      let [v, r, s] = sign(Buffer.from(D.toBuffer(rlpHash.slice(2))), node.keyPair.d)

      let signedTx = [tx.nonce, tx.gasPrice, tx.startGas, tx.output.address, tx.output.value, tx.data, v, r, s]

      let rawTx = D.toHex(rlp.encode(signedTx)).toLowerCase()
      // noinspection JSCheckFunctionSignatures
      let txId = Web3.utils.keccak256(rlp.encode(signedTx))
      return {
        id: txId,
        hex: rawTx
      }
    }

    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return signBtc()
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        return signEth()
      default:
        throw D.error.coinNotSupported
    }
  }
}
