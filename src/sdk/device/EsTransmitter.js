
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

    let generateRsaKeyPair = () => {
      return {
        pubKey: 'AA5F4336939CB4186FF1E5119D3E93D1A33C72EED1F40718149B9B240C9DF300510C30C631FD583CA99CEA2956B7A4549797FCE307D3132AD599904389C0411791FEFC3214B55F1ECD615EDCF5A409184C7D30CEB31905B9007482A74815F8422195D4B4A64B43131A4A04424F14EE46BA5146FC9DB2B1A306760CEC597FBD6F',
        priKey: 'DC2256316F55F208178C91DFE94D1C077D9F5D0A39E4E6000921247F9DA359E18BD0FDD4C498DCF22429E6D277AC89795422CF295CE25C153CDDA3CC5402845FC62161D3E8C80244E4E616983211609F6A3A5DEE0967D0F4AC1A913C3C84C7FFA72DEC760DE3125706158BBC8405D599203885F4B67149E7DF31237D0372E0F1554CCCDF7D07EDB06B07A263047147C23350746A09030488D100D1B6CDABC5A15B5F516C87FDBFE7E851804ADFEAB09E9E169AF5A93361812D43A93BFCF5B8BB8B3629669BC8ECCF3B85EF9A4093B5304D93752C2BAFA642442AE6A14C647FA241F5229050719C1149551A39FB099E6B59185E06F3A9E623E5CEC100B5CBA2019EDF52B0BC2FEE818C24A685AAB9D40E76E4E420C15D9690F85FD7D09322F43176582C9D068FC31B968A11950774766AC1A28B8E7A8AD16B5EF52E7981EA3BF7',
        N: 'AA5F4336939CB4186FF1E5119D3E93D1A33C72EED1F40718149B9B240C9DF300510C30C631FD583CA99CEA2956B7A4549797FCE307D3132AD599904389C0411791FEFC3214B55F1ECD615EDCF5A409184C7D30CEB31905B9007482A74815F8422195D4B4A64B43131A4A04424F14EE46BA5146FC9DB2B1A306760CEC597FBD6F'
      }
      var MattsRSAkey = cryptico.generateRSAKey(D.makeId, Bits);
    }

    let modLen = 0x80 // RSA1024
    let genHandShakeApdu = () => {
      let blkAysmKey = generateRsaKeyPair(modLen * 8)
      let apdu = new ArrayBuffer(0x49)
      copy('80334B4E00048402010000', 0, apdu, 0)
      copy(blkAysmKey.N, 0, apdu, 0x0b)
      return {blkAysmKey, apdu}
    }

    let parseHandShakeResponse = (tempKeyPair, response) => {
      let recoverDevPubKey = (factoryKey, hostKey, response) => {
        let devCert = slice(response, 0, modLen)
        let encSKey = slice(response, modLen, modLen)
        let devSign = slice(response, modLen * 2, modLen)
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
    if (typeof apdu === 'string') {
      apdu = D.toBuffer(apdu)
    }
    // HID command format: u1PaddingNum 04 pu1Send[u4SendLen] Padding
    // don't set feature id in hid command, chrome.hid will add it automatically to the head
    let packHidCmd = (apdu) => {
      // additional length of {u1PaddingNum 04}
      let reportId = 0x00
      let reportSize = apdu.byteLength + 0x02
      let packView = new Uint8Array(reportSize + (1 + reportSize) % 0x08)
      if (reportSize <= 0x110) {
        if ((reportSize & 0x07) !== 0x00) {
          reportSize &= (~0x07)
          reportSize += 0x08
        }
        reportId = reportSize >> 0x03
      } else if (reportSize <= 0x210) {
        reportSize -= 0x110
        if ((reportSize & 0x3F) !== 0x00) {
          reportSize &= ~0x3F
          reportSize += 0x40
        }
        reportId = 0x22 + reportSize >> 0x06
        reportSize += 0x110;
      } else if (reportSize <= 0x410) {
        reportSize -= 0x210;
        if ((reportSize & 0x7F) !== 0x00) {
          reportSize &= ~0x7F
          reportSize += 0x80
        }
        reportId = 0x26 + reportSize >> 0x07
        reportSize += 0x210
      } else {
        reportSize -= 0x410
        if ((reportSize & 0xFF) !== 0x00) {
          reportSize &= ~0xFF
          reportSize += 0x100
        }
        reportId = 0x2A + reportSize >> 0x08
        reportSize += 0x410
      }
      packView[0x00] = reportSize - apdu.byteLength - 0x03 // Padding num
      packView[0x01] = 0x04 // opCode
      packView.set(new Uint8Array(apdu), 0x02)

      let pack = packView.buffer
      return {reportId, pack}
    }

    // HID response format: u1ReportId u1PaddingNum 04 RESPONSE SW1 SW2 Padding[PaddingNum]
    let unpackHidCmd = (response) => {
      let resView = new Uint8Array(response)
      if (resView[0x02] !== 0x04) {
        console.warn('opCode != 0x04 not supported')
        throw D.error.notImplemented
      }

      let throwLengthError = () => {
        console.warn('unpackHidCmd hid response length incorrect', resView)
        throw D.error.deviceComm
      }

      // get report size from report id
      let reportSize
      if (resView[0x00] <= 0x22) {
        reportSize = resView[0x00] * 0x08;
        if (resView[0x01] > 0x07) throw throwLengthError()
      } else if (resView[0x00] <= 0x26) {
        reportSize = 0x110 + (resView[0x00] - 0x22) * 0x40;
        if (resView[0x01] > 0x3F) throw throwLengthError()
      } else if (resView[0x00] <= 0x2A) {
        reportSize = 0x210 + (resView[0x00] - 0x26) * 0x80;
        if (resView[0x01] > 0x7F) throw throwLengthError()
      } else {
        reportSize = 0x410 + (resView[0x00] - 0x2A) * 0x100;
      }

      if (reportSize < (resView[0x01] + 0x03)) throw throwLengthError()
      reportSize -= (resView[0x01] + 0x03)
      if (reportSize < 0x02) throwLengthError()
      reportSize -= 0x02

      response = slice(response, 3, 3 + reportSize)
      let result = resView[0x03 + reportSize] << 8 + resView[0x04 + reportSize]
      return {result, response}
    }

    let {reportId, pack} = packHidCmd(apdu)
    let response = await this._device.sendAndReceive(reportId, pack)
    return unpackHidCmd(response)
  }
}
