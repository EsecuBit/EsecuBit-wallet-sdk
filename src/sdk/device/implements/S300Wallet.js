
import D from '../../D'
import rlp from 'rlp'
import BigInteger from 'bigi'
import bitPony from 'bitpony'
import {Buffer} from 'buffer'

// rewrite _containKeys to make empty value available, so we can use it to build presign tx
// noinspection JSPotentiallyInvalidConstructorUsage
bitPony.prototype._containKeys = function (keys) {
  for (let i of keys) {
    if (this.data[i] === null) {
      throw new Error('key ' + this.type + '.' + i + ' can not be null ' + this.data[i])
    }
  }
}

export default class S300Wallet {
  constructor (transmitter) {
    this._transmitter = transmitter
    this._allEnc = false
  }

  async init () {
    await this._transmitter.reset()
    await this._select()

    let walletId = D.test.coin ? '01' : '00'
    walletId += D.test.jsWallet ? '01' : '00'
    walletId += D.address.toBuffer(await this.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")).toString('hex')
    return {walletId: walletId}
  }

  async _select () {
    await this._sendApdu('00A4040006B00000000002', false)
  }

  async getWalletInfo () {
    let cosVersion = await this._getCosVersion()
    return {
      sdk_version: D.sdkVersion,
      cos_version: cosVersion
    }
  }

  async _getCosVersion () {
    console.warn('get version not supported yet!')
    return 'get version not supported yet'
  }

  async getAddress (coinType, path, isShowing = false, isStoring = false) {
    // bit 0: 0 not save on key / 1 save on key
    // bit 1: 0 not show on key / 1 show on key
    // bit 2: 0 public key / 1 address
    // bit 3: 0 uncompressed / 1 compressed
    // if bit2 == 0, bit0 == bit1 == 0
    let flag = 0
    flag += isStoring ? 0x01 : 0x00
    flag += isShowing ? 0x02 : 0x00
    flag += 0x04
    flag += 0x08

    let apduHead = Buffer.from('804600001505', 'hex')
    let pathBuffer = D.address.path.toBuffer(path)
    let apdu = Buffer.concat([apduHead, pathBuffer])
    apdu[3] = flag

    let response = await this._sendApdu(apdu, false)
    let address = String.fromCharCode.apply(null, new Uint8Array(response))
    // device only return mainnet address
    if (coinType === D.coin.test.btcTestNet3) {
      try {
        let addressBuffer = D.address.toBuffer(address)
        addressBuffer = Buffer.concat([Buffer.from('6F', 'hex'), addressBuffer])
        address = D.address.toString(addressBuffer)
      } catch (e) {
        // TODO remove, S300 bug: return address with constant length 34.
        let addressBuffer = D.address.toBuffer(address.slice(0, address.length - 1))
        addressBuffer = Buffer.concat([Buffer.from('6F', 'hex'), addressBuffer])
        address = D.address.toString(addressBuffer)
      }
    }
    return address
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
   *   changePath: string,
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
   *   data: 0x string,
   * }
   */
  async signTransaction (coinType, tx) {
    let sign = async (path, changePath, msg) => {
      // 8048 state flag length C0 u1PathNum pu1Path C1 u1ChangePathNum pu1ChangePath C2 xxxx pu1Msg
      let dataLength =
        2 + path.length +
        (changePath ? (2 + changePath.length) : 2) +
        3 + msg.length

      let data = Buffer.allocUnsafe(dataLength)
      let index = 0
      data[index++] = 0xC0
      data[index++] = path.length / 4
      path.copy(data, index)
      index += path.length

      data[index++] = 0xC1
      data[index++] = changePath ? (changePath.length / 4) : 0
      if (changePath) changePath.copy(data, index)
      index += changePath ? changePath.length : 0

      data[index++] = 0xC2
      data[index++] = msg.length >> 8
      data[index++] = msg.length
      msg.copy(data, index)

      let compressChange = 0x08
      let response
      if (data.length <= 0xFF) {
        let apduHead = Buffer.from('8048030000', 'hex')
        apduHead[3] |= compressChange
        apduHead[4] = data.length
        response = await this._sendApdu(Buffer.concat([apduHead, data]), true)
      } else {
        let remainLen = data.length
        // devide tx to sign due to wallet command length limit
        while (true) {
          if (remainLen <= 0xFF) {
            let apduHead = Buffer.from('8048020000', 'hex')
            apduHead[3] |= compressChange
            apduHead[4] = remainLen
            let offset = data.length - remainLen
            response = await this._sendApdu(Buffer.concat([apduHead, data.slice(offset, data.length)]), true)
            break
          } else if (remainLen === data.length) {
            // first package
            let apduHead = Buffer.from('80480100FF', 'hex')
            await this._sendApdu(Buffer.concat([apduHead, data.slice(0, 0xFF)]), true)
          } else {
            // middle package
            let apduHead = Buffer.from('80480000FF', 'hex')
            apduHead[3] |= compressChange
            let offset = data.length - remainLen
            await this._sendApdu(Buffer.concat([apduHead, data.slice(offset, offset + 0xFF)]), true)
          }
          remainLen -= 0xFF
        }
      }

      let r = response.slice(0, 32)
      let s = response.slice(32, 64)
      let pubKey = response.slice(64, 128)
      let v = response[128] % 2

      let n = BigInteger.fromHex('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')
      const N_OVER_TWO = n.shiftRight(1)
      let sInt = BigInteger.fromBuffer(s)
      if (sInt.compareTo(N_OVER_TWO) > 0) {
        console.debug('s > N/2, s = N/2 - r, old s, v', s.toString('hex'), v)
        sInt = n.subtract(sInt)
        let sHex = sInt.toHex()
        sHex = (sHex.length % 2) ? ('0' + sHex) : sHex
        s = Buffer.from(sHex, 'hex')
        v = v ? 0 : 1
        console.debug('new s, v', s.toString('hex'), v)
      }
      return {v, r, s, pubKey}
    }

    let signBtc = async (tx) => {
      let makeBasicScript = (tx) => {
        return {
          version: 1,
          inputs: tx.inputs.map(input => {
            return {
              hash: input.txId,
              index: input.index,
              scriptSig: input.script,
              sequence: 0xFFFFFFFD // opt-in full-RBF, BIP 125
            }
          }),
          outputs: tx.outputs.map(output => {
            let scriptPubKey = D.address.makeOutputScript(output.address)
            return {
              amount: output.value,
              scriptPubKey: scriptPubKey
            }
          }),
          lockTime: 0
        }
      }

      let makePreSignScript = (i, basicScript) => {
        let script = D.copy(basicScript)
        script.inputs.forEach((input, j) => {
          if (i !== j) input.scriptSig = ''
        })
        let preSignScript = bitPony.tx.write(
          script.version, script.inputs, script.outputs, script.lockTime)
        return Buffer.concat([preSignScript, Buffer.from('01000000', 'hex')])
      }

      let makeScriptSig = (r, s, pubKey) => {
        // DER encode
        let scriptSigLength = 0x03 + 0x22 + 0x22 + 0x01 + 0x22
        // s must < N/2, r has no limit
        let upperR = r[0] >= 0x80
        if (upperR) scriptSigLength++

        let scriptSig = Buffer.allocUnsafe(scriptSigLength)
        let index = 0
        let sigLength = 0x22 + 0x22 + (upperR ? 0x01 : 0x00)
        scriptSig[index++] = 0x03 + sigLength
        scriptSig[index++] = 0x30
        scriptSig[index++] = sigLength
        // r
        scriptSig[index++] = 0x02
        scriptSig[index++] = upperR ? 0x21 : 0x20
        if (upperR) scriptSig[index++] = 0x00
        r.copy(scriptSig, index)
        index += r.length
        // s
        scriptSig[index++] = 0x02
        scriptSig[index++] = 0x20
        s.copy(scriptSig, index)
        index += s.length
        // hashType
        scriptSig[index++] = 0x01
        // pubKey, compressed type
        scriptSig[index++] = 0x21
        scriptSig[index++] = pubKey[63] % 2 === 0 ? 0x02 : 0x03
        pubKey = pubKey.slice(0, 32)
        pubKey.copy(scriptSig, index)

        return scriptSig
      }

      let basicScript = makeBasicScript(tx)
      let signedTx = D.copy(basicScript)
      let changePathBuffer = tx.changePath && D.address.path.toBuffer(tx.changePath)
      // execute in order
      let sequence = Promise.resolve()
      tx.inputs.forEach((input, i) => {
        sequence = sequence.then(async () => {
          let pathBuffer = D.address.path.toBuffer(input.path)
          let preSignScript = makePreSignScript(i, basicScript)
          let {r, s, pubKey} = await sign(pathBuffer, changePathBuffer, preSignScript)
          let scirptSig = makeScriptSig(r, s, pubKey)
          signedTx.inputs[i].scriptSig = scirptSig.toString('hex')
        })
      })
      await sequence

      signedTx = bitPony.tx.write(signedTx.version, signedTx.inputs, signedTx.outputs, signedTx.lockTime).toString('hex')
      return {
        id: bitPony.tx.read(signedTx).hash,
        hex: signedTx
      }
    }

    let signEth = async (tx) => {
      const chainIds = {}
      chainIds[D.coin.main.eth] = 1
      chainIds[D.coin.test.ethRinkeby] = 4
      let chainId = chainIds[coinType]
      if (!chainId) throw D.error.coinNotSupported

      // rlp
      let unsignedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data, chainId, 0, 0]
      let rlpUnsignedTx = rlp.encode(unsignedTx)

      let {v, r, s} = await sign(D.address.path.toBuffer(tx.input.path), null, rlpUnsignedTx)
      let signedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data,
        35 + chainId * 2 + (v % 2), r, s]
      let rawTx = rlp.encode(signedTx).toString('hex')
      let txId = D.address.keccak256(rlp.encode(signedTx))
      return {
        id: txId,
        hex: rawTx
      }
    }

    if (D.isBtc(coinType)) {
      return signBtc(tx)
    } else if (D.isEth(coinType)) {
      return signEth(tx)
    } else {
      throw D.error.coinNotSupported
    }
  }

  _sendApdu (apdu, isEnc = false) {
    // S300 currently not support enc command
    return this._transmitter.sendApdu(apdu, false) // this._allEnc || isEnc
  }
}
