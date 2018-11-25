
import D from '../../D'
import rlp from 'rlp'
import BigInteger from 'bigi'
import bitPony from 'bitpony'
import {Buffer} from 'buffer'
import HandShake from './protocol/HandShake'
import Authenticate from './protocol/Authenticate'
import Settings from '../../Settings'

// rewrite _containKeys to make empty value available, so we can use it to build presign tx
// noinspection JSPotentiallyInvalidConstructorUsage
bitPony.prototype._containKeys = function (keys) {
  for (let i of keys) {
    if (this.data[i] === null) {
      throw new Error('key ' + this.type + '.' + i + ' can not be null ' + this.data[i])
    }
  }
}

export default class NetBankWallet {
  constructor (transmitter) {
    this._transmitter = transmitter
    this._allEnc = false
  }

  async init (authCallback) {
    console.log('NetBankWallet init')
    if (!authCallback) {
      console.warn('NetBankWallet auth missing authCallback')
      throw D.error.invalidParams
    }

    let deivceName = this._transmitter.getName && this._transmitter.getName()
    let oldFeature = await new Settings().getSetting('netBankFeature', deivceName)
    console.log('NetBankWallet old feature', oldFeature)
    oldFeature = oldFeature && Buffer.from(oldFeature, 'hex')
    let authenticate = new Authenticate('Esecubit', this, oldFeature)
    let newFeature
    try {
      newFeature = await authenticate.prepareAuth()
      if (!oldFeature) {
        let pairCode = String.fromCharCode.apply(null,
          newFeature.slice(newFeature.length - 4))
        authCallback(pairCode)
      }
      console.log('NetBankWallet do authenticate')
      await authenticate.auth()
      console.log('NetBankWallet authenticate succeed')
      if (!oldFeature) {
        let featureHex = newFeature.toString('hex')
        await new Settings().setSetting('netBankFeature', featureHex, deivceName)
        console.log('NetBankWallet new feature', featureHex)
      }
    } catch (e) {
      if (e === D.error.deviceApduDataInvalid) {
        console.info('authenticate not support, ignore')
      } else {
        console.warn('autenticate failed', e)
        throw e
      }
    }

    this._handShake = new HandShake(oldFeature || newFeature)
    this._allEnc = true
    let walletId = D.test.coin ? '01' : '00'
    walletId += D.test.jsWallet ? '01' : '00'
    walletId += D.address.toBuffer(await this.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")).toString('hex')

    return {walletId}
  }

  async getWalletInfo () {
    let cosVersion = await this._getCosVersion()
    return {
      sdk_version: D.sdkVersion,
      cos_version: cosVersion
    }
  }

  // noinspection JSMethodCanBeStatic
  async _getCosVersion () {
    return (await this.sendApdu('803300000ABD080000000000000000')).toString('hex')
  }

  async verifyPin () {
    return this.sendApdu('8082008100')
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
    let apdu = Buffer.allocUnsafe(26)
    Buffer.from('803D00001505', 'hex').copy(apdu)
    apdu[3] = flag
    let pathBuffer = D.address.path.toBuffer(path)
    pathBuffer.copy(apdu, 0x06)

    let response = await this.sendApdu(apdu)
    let address = String.fromCharCode.apply(null, response)
    // device only return mainnet address
    if (coinType === D.coin.test.btcTestNet3) {
      let addressBuffer = D.address.toBuffer(address)
      addressBuffer = Buffer.concat([Buffer.from('6F', 'hex'), addressBuffer])
      address = D.address.toString(coinType, addressBuffer)
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
      // 803D0100 00XXXX C0 u1PathNum pu1Path C1 u1ChangePathNum pu1ChangePath C2 xxxx pu1Msg
      let dataLength =
        2 + path.length +
        (changePath ? (2 + changePath.length) : 2) +
        3 + msg.length
      let apdu = Buffer.allocUnsafe(7 + dataLength)
      Buffer.from('803D0100', 'hex').copy(apdu)
      let index = 4
      apdu[index++] = dataLength >> 16
      apdu[index++] = dataLength >> 8
      apdu[index++] = dataLength

      apdu[index++] = 0xC0
      apdu[index++] = path.length / 4
      path.copy(apdu, index)
      index += path.length

      apdu[index++] = 0xC1
      apdu[index++] = changePath ? (changePath.length / 4) : 0
      if (changePath) changePath.copy(apdu, index)
      index += changePath ? changePath.length : 0

      apdu[index++] = 0xC2
      apdu[index++] = msg.length >> 8
      apdu[index++] = msg.length
      msg.copy(apdu, index)

      let response = await this.sendApdu(apdu, true)
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

    let signBtc = async (coinType, tx) => {
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
            let scriptPubKey = D.address.makeOutputScript(coinType, output.address)
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
      let chainId = D.coin.params.eth.getChainId(coinType)

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

    await this.verifyPin()
    if (D.isBtc(coinType)) {
      return signBtc(coinType, tx)
    } else if (D.isEth(coinType)) {
      return signEth(tx)
    } else {
      console.warn('NetBankWallet signTransaction don\'t support this coinType', coinType)
      throw D.error.coinNotSupported
    }
  }

  async getRandom (length) {
    if (length > 255) throw D.error.notImplemented
    let apdu = '00840000' + (length >> 8) + (length % 0xFF)
    return this.sendApdu(apdu)
  }

  /**
   * APDU encrypt & decrypt
   */
  async sendApdu (apdu, isEnc = false) {
    isEnc = this._allEnc || isEnc
    // a simple lock to guarantee apdu order
    while (this._busy) {
      await D.wait(10)
    }
    this._busy = true

    try {
      if (typeof apdu === 'string') {
        apdu = Buffer.from(apdu, 'hex')
      }
      console.log('send apdu', apdu.toString('hex'), 'isEnc', isEnc)
      if (isEnc) {
        // 1. some other program may try to send command to device
        // 2. in some limit situation, device is not stable yet
        // try up to 3 times
        await this._doHandShake()
          .catch(() => this._doHandShake())
          .catch(() => this._doHandShake())
        apdu = this._handShake.encApdu(apdu)
        console.debug('send enc apdu', apdu.toString('hex'))
      }
      let response = await this._transmit(apdu)
      if (isEnc) {
        console.debug('got enc response', response.toString('hex'), 'isEnc', isEnc)
        let decResponse = this._handShake.decResponse(response)
        NetBankWallet._checkSw1Sw2(decResponse.result)
        response = decResponse.response
      }
      console.log('got response', response.toString('hex'), 'isEnc', isEnc)
      return response
    } finally {
      this._busy = false
    }
  }

  async _doHandShake () {
    if (this._handShake.isFinished) return
    let {tempKeyPair, apdu} = this._handShake.generateHandshakeApdu()
    let response = await this._transmit(apdu)
    this._handShake.parseHandShakeResponse(response, tempKeyPair, apdu)
  }

  /**
   * APDU special response handling
   */
  async _transmit (apdu) {
    let {result, response} = await this._transmitter.transmit(apdu)

    // 6AA6 means busy, send 00A6000008 immediately to get response
    while (result === 0x6AA6) {
      console.debug('got 0xE0616AA6, resend apdu')
      let {_result, _response} = await this._transmitter.transmit(Buffer.from('00A6000008'), 'hex')
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      console.debug('got 0x61XX, get remain data')
      let rApdu = Buffer.from('00C0000000', 'hex')
      rApdu[0x04] = result & 0xFF
      let ret = await this._transmitter.transmit(rApdu)
      response = Buffer.concat([response, ret.response])
      result = ret.result
    }
    NetBankWallet._checkSw1Sw2(result)

    return response
  }

  static _checkSw1Sw2 (sw1sw2) {
    let errorCode = D.error.checkSw1Sw2(sw1sw2)
    if (errorCode !== D.error.succeed) throw errorCode
  }
}
