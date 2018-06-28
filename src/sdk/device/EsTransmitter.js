
import D from '../D'

const sKeyEncKey = D.toBuffer('78648bd32a96310a80227f759fa7b489')
const factoryPubKey = D.toBuffer(
  'B721A1039865ABB07039ACA0BC541FBE' +
  '1A4C3FF707619F68FCCD1F59CACC39D2' +
  '310A5BA1E8B39E179E552E97B305854C' +
  '0276E356AFE06ED6FD9A1969FE9B3EBC' +
  '9889A5C5F00498449FA41EE12FB3BE21' +
  '40F3DAFFBF4075ECDF8C04DF343BB853' +
  '47D39C6B7739DFD5AD81BB2E09ADCDC1' +
  '7959A89E7617E297B0AEB6DFA084E5E1')
const sha1HashLen = 0x14

let copy = (src, srcOffset, dest, destOffset, length) => {
  if (typeof src === 'string') {
    src = D.toBuffer(src)
  }
  let srcView = new Uint8Array(src)
  length = length || srcView.length - srcOffset
  let destView = new Uint8Array(dest)
  srcView.slice(srcOffset, srcOffset + length).map((value, i) => destView[i + destOffset] = value)
}

let concat = (a, b) => {
  if (typeof a === 'string') {
    a = D.toBuffer(a)
  }
  if (typeof b === 'string') {
    b = D.toBuffer(b)
  }
  let c = new ArrayBuffer(a.byteLength + b.byteLength)
  let av = new Uint8Array(a)
  let bv = new Uint8Array(b)
  let cv = new Uint8Array(c)
  cv.set(av, 0)
  cv.set(bv, av.length)
  return c
}

let slice = (src, start, end) => {
  if (typeof src === 'string') {
    src = D.toBuffer(src)
  }
  let srcv = new Uint8Array(src)
  srcv = srcv.slice(start, end)
  let ret = new Uint8Array(srcv.length)
  ret.set(srcv, 0)
  return ret.buffer
}

/**
 * Hardware apdu protocol
 */
export default class EsTransmitter {

  constructor (device) {
    this._device = device
    this._commKey = {
      generated: false
    }
    this._extKey = {}
  }

  /**
   * handshake using rsa and 3DES112
   */
  async _doHandShake () {
    if (this._commKey.generated) return

    let modLen = 0x80 // RSA1024
    let genHandShakeApdu = () => {
      let blkAysmKey = generateRsaKeyPair(modLen * 8)
      let apdu = new ArrayBuffer(0x49)
      let apduView = new Uint8Array(apdu)
      copy('80334B4E00048402010000', 0, apdu, 0)
      copy(blkAysmKey.N, 0, apdu, 0x0b)

      return {blkAysmKey, apdu}
    }

    let parseHandShakeResponse = (tempKeyPair, response) => {
      let recoverDevPubKey = (factoryKey, hostKey) => {

      }

      let makeKey = (devCert) => {
        let pos = 2 * modLen - sha1HashLen
        let sKeyCount = new ArrayBuffer(0x04)
        copy(devCert, pos, sKeyCount, 0, 0x04)
        let sKeyPlain = new ArrayBuffer(0x10)
        copy(devCert, pos + 0x04, sKeyPlain, 0, 0x10)
        let sKey = des112(sKeyEncKey, sKeyPlain)
      }

      let responseView = new Uint8Array(response)
      let recvNoSign = new ArrayBuffer(responseView.length - modLen)
      copy(response, 0, recvNoSign, 0, responseView.length - modLen)

      let {devPubKey, devCert} = recoverDevPubKey(factoryPubKey, tempKeyPair, response)
      // verifyDevSignature(sha1, devPubKey, ...)

      return makeKey(devCert)
    }

    let {tempKeyPair, apdu} = await genHandShakeApdu()
    let response = await this.sendApdu(apdu)
    this._commKey = parseHandShakeResponse(tempKeyPair, response)
  }

  async sendApdu (apdu, isEnc = false) {
    let makeEncApdu = () => {
      // TODO
    }

    if (isEnc) {
      await this._doHandShake()
      apdu = makeEncApdu(apdu)
    }
    return this._sendApdu(apdu)
  }

  async _sendApdu (apdu) {
    let {result, response} = await this._transmit(apdu)

    // 6AA6 means busy, send 00A6000008 immediately to get response
    while (result === 0x6AA6) {
      console.log('got 0xE0616AA6, resend apdu')
      let {_result, _response} = this._transmit(D.toBuffer('00A6000008'))
      response = concat(response, _response)
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      let rApdu = D.toBuffer('00C0000000')
      new Uint8Array(rApdu)[0x04] = result & 0xFF
      let {_result, _response} = this._transmit(rApdu)
      response = concat(response, _response)
      result = _result
    }

    if (result !== 0x9000) {
      console.warn('send apdu got', result)
      throw D.error.deviceProtocol
    }

    return response
  }

  async _transmit (apdu) {
    // package
    // TODO package
    let pack = concat('0004', apdu)
    let response = await this._device.sendAndReceive(pack)

    // unpackage
    let resView = new Uint8Array(response)
    let paddingNum = resView[1]

    // Uint8Array don't support negative index
    let result = (resView[resView.length - paddingNum - 2] << 8) + resView[resView.length - paddingNum - 1]
    response = slice(response, 3, -2 - paddingNum)
    return {result, response}
  }
}
