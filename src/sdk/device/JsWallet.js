// powered by btc-js and web3

import ecurve from 'ecurve'
import bitcoin from 'bitcoinjs-lib'
import BigInteger from 'bigi'
import createHmac from 'create-hmac'
import rlp from 'rlp'
import D from '../D'
import FcBuffer from './EosFcBuffer'
import createHash from 'create-hash'
import base58 from 'bs58'

export default class JsWallet {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this
    this.cache = {}
  }

  async init (seed) {
    this._root = bitcoin.HDNode.fromSeedHex(seed)

    let walletId = D.test.coin ? '01' : '00'
    walletId += D.test.jsWallet ? '01' : '00'
    walletId += D.address.toBuffer(await this.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")).toString('hex')
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
      sdk_version: '0.4.0',
      cos_version: '20180927'
    }
  }

  // noinspection JSMethodCanBeStatic
  async verifyPin () {
    return true
  }

  async _derive (path) {
    try {
      let node = this._root
      path = path.toString()

      let lastIndex = path.lastIndexOf('/')
      let parentPath = path.slice(0, lastIndex)
      path = path.slice(lastIndex + 1)
      // build cache to improve speed
      if (this.cache[parentPath]) {
        node = this.cache[parentPath]
      } else {
        node = node.derivePath(parentPath)
        this.cache[parentPath] = node
      }
      return node.derivePath(path)
    } catch (e) {
      console.warn(e)
      throw D.error.unknown
    }
  }

  async getPublicKey (coinType, keyPath) {
    let node = await this._derive(keyPath)
    let publicKey = node.getPublicKeyBuffer()
    // let chainCode = node.chainCode

    if (D.isEos(coinType)) {
      let checksum = createHash('ripemd160').update(publicKey).digest().slice(0, 4)
      publicKey = 'EOS' + base58.encode(Buffer.concat([publicKey, checksum]))
    } else {
      publicKey.toString('hex')
    }
    return publicKey
  }

  async getAddress (coinType, addressPath) {
    let btcAddress = async (addressPath) => {
      let node = await this._derive(addressPath)
      node.keyPair.network = D.coin.params.btc.getNetwork(coinType)
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
    await this.verifyPin()
    if (D.isBtc(coinType)) {
      return this._signBtc(coinType, tx)
    } else if (D.isEth(coinType)) {
      return this._signEth(coinType, tx)
    } else if (D.isEos(coinType)) {
      return this._signEos(coinType, tx)
    } else {
      throw D.error.coinNotSupported
    }
  }

  async _signBtc (coinType, tx) {
    try {
      let network = D.coin.params.btc.getNetwork(coinType)
      let txb = new bitcoin.TransactionBuilder(network)
      txb.setVersion(1)
      for (let input of tx.inputs) {
        txb.addInput(input.txId, input.index, 0xfffffffd) // opt-in full-RBF, BIP 125
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

  async _signEth (coinType, tx) {
    let chainId = D.coin.params.eth.getChainId(coinType)
    if (!chainId) throw D.error.coinNotSupported

    let unsignedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data, chainId, 0, 0]
    let rlpUnsignedTx = rlp.encode(unsignedTx)
    let rlpHash = D.address.keccak256(rlpUnsignedTx)
    let node = await this._derive(tx.input.path)
    let [recId, r, s] = this._sign(Buffer.from(rlpHash.slice(2), 'hex'), node.keyPair.d)
    let v = chainId * 2 + 35 + recId

    let signedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data,
      v, '0x' + r.toString('hex'), '0x' + s.toString('hex')]

    let rawTx = rlp.encode(signedTx).toString('hex')
    let txId = D.address.keccak256(rlp.encode(signedTx))
    return {
      id: txId,
      hex: rawTx
    }
  }

  // noinspection JSMethodCanBeStatic
  async _signEos (coinType, tx) {
    let chainId = D.coin.params.eos.getChainId(coinType)

    let rawTx = FcBuffer.serializeTx(tx)
    console.log('_signEos rawTx', rawTx.toString('hex'))
    let packedContextFreeData = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
    let signBuf = Buffer.concat([chainId, rawTx, packedContextFreeData])

    let hash = createHash('sha256').update(signBuf).digest()

    tx = D.copy(tx)
    let signedTx = {
      compression: 'none',
      packedContextFreeData: '',
      packed_trx: rawTx.toString('hex'),
      signatures: []
    }
    for (let keyPath of tx.keyPaths) {
      let node = await this._derive(keyPath)
      let [recId, r, s] = this._sign(hash, node.keyPair.d)
      let i = recId + 4 + 27
      let buffer = Buffer.allocUnsafe(65)
      buffer.writeUInt8(i, 0)
      r.copy(buffer, 1)
      s.copy(buffer, 33)

      let checkBuffer = Buffer.concat([buffer, Buffer.from('K1')])
      let check = createHash('ripemd160').update(checkBuffer).digest().slice(0, 4)
      let signature = base58.encode(Buffer.concat([buffer, check]))
      signedTx.signatures.push('SIG_K1_' + signature)
    }

    let txId = createHash('sha256').update(rawTx).digest().toString('hex')
    return {txId, signedTx}
  }

  // copy from ecdsa.sign(hash, d) in bitcoinjs, returing [recId, r, s] format
  _sign (hash, d) {
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

    let r = Buffer.alloc(0)
    let s = Buffer.alloc(0)
    let recId = 0
    deterministicGenerateK(hash, x, (k) => {
      let Q = G.multiply(k)

      if (secp256k1.isInfinity(Q)) return false

      r = Q.affineX.mod(n)
      if (r.signum() === 0) return false
      // eos canonical signature, both r and s should be < 0x80
      // see https://github.com/EOSIO/eosjs-ecc/commit/09c823ac4c4fb4f7257d8ed2df45a34215a8c537
      if (r.compareTo(N_OVER_TWO) > 0) return false

      // for recId, see https://bitcoin.stackexchange.com/questions/38351/ecdsa-v-r-s-what-is-v
      recId = Q.affineY.mod(BigInteger.fromHex('02')).intValue()

      s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n)
      // noinspection RedundantIfStatementJS
      if (s.signum() === 0) return false

      // make s be lower s
      if (s.compareTo(N_OVER_TWO) > 0) {
        s = n.subtract(s)
        recId = recId ? 0 : 1
      }

      if (Q.affineX.compareTo(secp256k1.p.mod(n)) < 0) {
        recId += 2
      }
      return true
    })
    return [
      recId,
      r.toBuffer(),
      s.toBuffer()
    ]
  }
}
