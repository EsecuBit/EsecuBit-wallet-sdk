// powered by btc-js and web3

import ecurve from 'ecurve'
import bitcoin from 'bitcoinjs-lib'
import BigInteger from 'bigi'
import createHmac from 'create-hmac'
import rlp from 'rlp'
import D from '../D'

export default class JsWallet {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this
    this.cache = {}
  }

  init (initSeed) {
    const btcNetwork = D.test.coin ? bitcoin.networks.testnet : bitcoin.networks.btc
    const defaultSeed = D.test.sync ? D.test.syncSeed : D.test.txSeed
    let walletId = D.test.coin ? '01' : '00'
    walletId += D.test.jsWallet ? '01' : '00'
    walletId += D.test.sync ? D.test.syncWalletId : D.test.txWalletId

    let seed = initSeed || defaultSeed
    this.btcNetwork = btcNetwork
    this._root = bitcoin.HDNode.fromSeedHex(seed, btcNetwork)
    console.log('seed', seed)
    console.log('walletId', walletId)
    return {walletId: walletId}
  }

  // noinspection JSMethodCanBeStatic
  async listenPlug (callback) {
    callback(D.error.succeed, D.status.plugIn)
  }

  // noinspection JSMethodCanBeStatic
  async getWalletInfo () {
    // TODO auto update sdk version
    return {
      sdk_version: '0.3.0',
      cos_version: '20180718'
    }
  }

  // noinspection JSMethodCanBeStatic
  async verifyPin () {
    return true
  }

  async _derive (path, pPublicKey) {
    try {
      let node = this._root
      path = path.toString()
      if (pPublicKey) {
        const ECPair = bitcoin.ECPair
        const HDNode = bitcoin.HDNode
        let curve = ecurve.getCurveByName('secp256k1')
        let Q = ecurve.Point.decodeFrom(curve, Buffer.from(pPublicKey.publicKey, 'hex'))
        let pChainCode = Buffer.from(pPublicKey.chainCode, 'hex')
        let keyPair = new ECPair(null, Q, {network: this.btcNetwork})
        node = new HDNode(keyPair, pChainCode)
      } else {
        // build cache to improve speed
        let lastIndex = path.lastIndexOf('/')
        let parentPath = path.slice(0, lastIndex)
        path = path.slice(lastIndex + 1)
        if (this.cache[parentPath]) {
          node = this.cache[parentPath]
        } else {
          node = node.derivePath(parentPath)
          this.cache[parentPath] = node
        }
      }
      return node.derivePath(path)
    } catch (e) {
      console.warn(e)
      throw D.error.unknown
    }
  }

  async getPublicKey (publicKeyPath, pPublicKey) {
    let node = await this._derive(publicKeyPath, pPublicKey)
    let publicKey = node.getPublicKeyBuffer().toString('hex')
    let chainCode = node.chainCode.toString('hex')
    return {publicKey, chainCode}
  }

  async getAddress (coinType, addressPath) {
    let btcAddress = async (addressPath) => {
      let node = await this._derive(addressPath)
      return node.getAddress()
    }

    let ethAddress = async (addressPath) => {
      let node = await this._derive(addressPath)
      let uncompressedPublicKey = node.keyPair.Q.getEncoded(false)
      let withoutHead = uncompressedPublicKey.slice(1)
      let hash = D.address.keccak256(withoutHead)
      return '0x' + hash.slice(-40)
    }

    let address
    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        address = await btcAddress(addressPath)
        break
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        address = await ethAddress(addressPath)
        break
      default:
        throw D.error.coinNotSupported
    }
    console.debug('path, address', addressPath, address)
    return address
  }

  // noinspection JSMethodCanBeStatic
  async getRandom (length) {
    Buffer.from(D.getRandomHex(length * 2), 'hex')
  }

  async publicKeyToAddress (publicKey) {
    const ECPair = bitcoin.ECPair
    let curve = ecurve.getCurveByName('secp256k1')
    let Q = ecurve.Point.decodeFrom(curve, Buffer.from(publicKey, 'hex'))
    let keyPair = new ECPair(null, Q, {network: this.btcNetwork})
    return keyPair.getAddress()
  }

  /**
   * @prarms tx:
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
   *   gasPrice: 0x string,
   *   gasLimit: 0x string,
   *   data: hex string,
   * }
   */
  async signTransaction (coinType, tx) {
    let signBtc = async () => {
      try {
        let txb = new bitcoin.TransactionBuilder(this.btcNetwork)
        txb.setVersion(1)
        for (let input of tx.inputs) {
          txb.addInput(input.txId, input.index, 0xfffffffd)
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

      const chainIds = {}
      chainIds[D.coin.main.eth] = 1
      chainIds[D.coin.test.ethRinkeby] = 4
      let chainId = chainIds[coinType]
      if (!chainId) throw D.error.coinNotSupported

      let unsignedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data, chainId, 0, 0]
      let rlpUnsignedTx = rlp.encode(unsignedTx)
      let rlpHash = D.address.keccak256(rlpUnsignedTx)
      let node = await this._derive(tx.input.path)
      let [v, r, s] = sign(Buffer.from(rlpHash.slice(2), 'hex'), node.keyPair.d)

      let signedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data, v, r, s]

      let rawTx = rlp.encode(signedTx).toString('hex')
      let txId = D.address.keccak256(rlp.encode(signedTx))
      return {
        id: txId,
        hex: rawTx
      }
    }

    await this.verifyPin()
    if (D.isBtc(coinType)) {
      return signBtc()
    } else if (D.isEth(coinType)) {
      return signEth()
    } else {
      throw D.error.coinNotSupported
    }
  }
}
