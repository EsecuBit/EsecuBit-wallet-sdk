
import D from '../D'
import MockDevice from './MockDevice'
import JSEncrypt from './jsencrypt'
import CryptoJS from 'crypto-js'

const sKeyEncKey = D.toBuffer('78648bd32a96310a80227f759fa7b489')
const factoryPubKeyPem = '-----BEGIN PUBLIC KEY-----' +
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3IaEDmGWrsHA5rKC8VB++Gkw/' +
  '9wdhn2j8zR9Zysw50jEKW6Hos54XnlUul7MFhUwCduNWr+Bu1v2aGWn+mz68mIml' +
  'xfAEmESfpB7hL7O+IUDz2v+/QHXs34wE3zQ7uFNH05xrdznf1a2Buy4Jrc3BeVmo' +
  'nnYX4pewrrbfoITl4QIDAQAB' +
  '-----END PUBLIC KEY-----'

let copy = D.buffer.copy
let concat = D.buffer.concat
let slice = D.buffer.slice

let sha1 = (data) => {
  if (typeof data === 'string') {
    data = D.toBuffer(data)
  }
  let input = CryptoJS.lib.WordArray.create(new Uint8Array(data))
  let plaintext = CryptoJS.SHA1(input)
  return D.toBuffer(plaintext.toString())
}

let des112 = (isEnc, data, key) => {
  let customPadding = (data) => {
    let padNum = 8 - data.byteLength % 8
    let padding = new Uint8Array(padNum)
    padding[0] = 0x80
    return concat(data, padding)
  }

  let removeCustomPadding = (data) => {
    if (typeof data === 'string') {
      data = D.toBuffer(data)
    }
    let dataView = new Uint8Array(data)
    let padNum = dataView[0]
    return slice(data, 1, data.byteLength - padNum)
  }

  if (typeof data === 'string') {
    data = D.toBuffer(data)
  }
  if (typeof key === 'string') {
    key = D.toBuffer(key)
  }

  if (isEnc) {
    data = customPadding(data)
  }
  let des168Key = concat(key, slice(key, 0, 8)) // des112 => des 168
  let input = CryptoJS.lib.WordArray.create(new Uint8Array(data))
  let pass = CryptoJS.lib.WordArray.create(new Uint8Array(des168Key))
  if (isEnc) {
    let encData = CryptoJS.TripleDES.encrypt(input, pass, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    })
    return D.toBuffer(encData.ciphertext.toString(CryptoJS.enc.Hex))
  } else {
    let plaintext = CryptoJS.TripleDES.decrypt({ciphertext: input}, pass,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.NoPadding
      })
    plaintext = plaintext.toString(CryptoJS.enc.Hex)
    return removeCustomPadding(plaintext)
  }
}

/**
 * Hardware apdu protocol
 */
export default class EsTransmitter {
  constructor (device) {
    this._device = device
    this._commKey = {
      sKey: null,
      generated: false
    }
    // TODO later used in bluetooth connection
    this._extKey = {}
  }

  /**
   * handshake using rsa and 3DES112
   */
  async _doHandShake () {
    if (this._commKey.generated) return

    let generateRsa1024KeyPair = () => {
      let keyPair = new JSEncrypt()
      if (D.test.mockDevice) {
        let testKeyPair = MockDevice.getTestTempRsaKeyPair()
        keyPair.setPrivateKey(testKeyPair.privKey)
        return keyPair
      }

      while (true) {
        // if keyPair don't have keys, generate random keypair immediately
        keyPair.getKey()
        // n.MSB must be 1
        let n = keyPair.key.n.toString(16)
        if (n.length !== 256 || n[0] < '8') {
          console.debug('n MSB == 0, regenerate')
          keyPair.key = undefined
          continue
        }
        break
      }
      return keyPair
    }

    let modLen = 0x80 // RSA1024
    let genHandShakeApdu = () => {
      let tempKeyPair = generateRsa1024KeyPair()
      let apdu = new ArrayBuffer(0x8B)
      copy('80334B4E00008402000000', 0, apdu, 0)
      let n = tempKeyPair.key.n.toString(16)
      n = concat(new ArrayBuffer(256 - n.length), n)
      copy(n, 0, apdu, 0x0B)
      return {tempKeyPair, apdu}
    }

    let parseHandShakeResponse = (hostKey, response, apdu) => {
      let removePadding = (data) => {
        let dataView = new Uint8Array(data)
        let pos = 0
        if (dataView[pos++] !== 0x00) {
          console.warn('decrypted device cert invalid padding, dataView[0] != 0x00', D.toHex(data))
          throw D.error.handShake
        }
        let type = dataView[pos++]
        while (dataView[pos]) {
          if (type === 0x01 && dataView[pos] !== 0xFF) {
            console.warn('decrypted device cert invalid padding, type === 0x01 but dataView[0] != 0xFF', D.toHex(data))
          }
          pos++
        }
        if (dataView[pos++] !== 0x00) {
          console.warn('decrypted device cert invalid padding dataView[last_padding] != 0x00', D.toHex(data))
          throw D.error.handShake
        }
        return slice(data, pos)
      }

      let buildPemPublicKeyHex = (publicKey) => {
        let firstByte = new Uint8Array(publicKey)[0]
        let prefix = (firstByte & 0x80)
          ? '30819f300d06092a864886f70d010101050003818d0030818902818100'
          : '30819e300d06092a864886f70d010101050003818c00308188028180'
        return concat(concat(prefix, publicKey), '0203010001')
      }

      let responseView = new Uint8Array(response)
      let recvNoSign = new ArrayBuffer(responseView.length - modLen)
      copy(response, 0, recvNoSign, 0, responseView.length - modLen)
      let factoryKey = new JSEncrypt()
      factoryKey.setPublicKey(factoryPubKeyPem)

      let devCert = slice(response, 0, modLen)
      let encSKey = slice(response, modLen, modLen * 2)
      let devSign = slice(response, modLen * 2, modLen * 3)

      // verify device cert by ca public key(factoryKey)
      let decDevCert = factoryKey.encrypt(D.toHex(devCert))
      if (!decDevCert) {
        console.warn('decrypted device cert encrypt failed')
        throw D.error.handShake
      }
      decDevCert = D.toBuffer(decDevCert)
      let orgDevCert = removePadding(decDevCert)

      const oidSha1 = '3021300906052B0E03021A05000414'
      if (D.toHex(slice(orgDevCert, 0, 15)).toUpperCase() !== oidSha1) {
        console.warn('decrypted device cert oid != sha1 ', D.toHex(orgDevCert))
        throw D.error.handShake
      }

      let tempLen = modLen - 0x2E
      let devPubHash = slice(orgDevCert, 15, 35)
      let devPubKey = slice(orgDevCert, 35, 35 + tempLen)

      // decrypt sKey by temp rsa key pair(hostKey)
      let decSKey = hostKey.decrypt(D.toHex(encSKey))
      if (!decSKey) {
        console.warn('decrypted enc skey failed', D.toHex(encSKey))
        throw D.error.handShake
      }
      decSKey = D.toBuffer(decSKey)
      let orgSKey = removePadding(decSKey)

      devPubKey = concat(devPubKey, slice(orgSKey, 0, 46))

      let devPubSha1 = sha1(devPubKey)
      if (D.toHex(devPubSha1) !== D.toHex(devPubHash)) {
        console.warn('sha1(devPubKey) != debPubHash', D.toHex(devPubKey), D.toHex(devPubHash))
        throw D.error.handShake
      }

      let sKeyCount = slice(orgSKey, 46, 50)
      let sKey = slice(orgSKey, 50, 66)

      // verify device sign by device public key(devPubKey)
      devPubKey = buildPemPublicKeyHex(devPubKey)
      let devPubKeyObj = new JSEncrypt()
      devPubKeyObj.setPublicKey(D.toHex(devPubKey))
      let orgDevSign = devPubKeyObj.encrypt(D.toHex(devSign))
      if (!orgDevSign) {
        console.warn('device signature encrypt failed')
        throw D.error.handShake
      }
      orgDevSign = D.toBuffer(orgDevSign)
      orgDevSign = removePadding(orgDevSign)

      let hashOrgValue = concat(slice(apdu, 7), concat(devCert, encSKey))
      let hashResult = sha1(hashOrgValue)

      let toSign = concat(oidSha1, hashResult)
      if (D.toHex(toSign) !== D.toHex(orgDevSign)) {
        console.warn('sign data not match')
        throw D.error.handShake
      }
      return {sKey, sKeyCount}
    }

    console.log('start hand shake')
    let {tempKeyPair, apdu} = genHandShakeApdu()
    let response = await this._sendApdu(apdu)
    let {sKey, sKeyCount} = parseHandShakeResponse(tempKeyPair, response, apdu)
    this._commKey.sKey = sKey
    this._commKey.sKeyCount = sKeyCount
    this._commKey.generated = true
    console.log('finish hand shake')
  }

  async sendApdu (apdu, isEnc = false) {
    let makeEncApdu = (apdu) => {
      let encryptedApdu = des112(true, apdu, this._commKey.sKey)

      // 8033 534D Lc         00 00 00 PaddingNum(1) SKeyCount(4) EncApdu
      let padNum = encryptedApdu.byteLength - apdu.byteLength
      let apduDataLen = 4 + this._commKey.sKeyCount.byteLength + encryptedApdu.byteLength
      let apduData = new Uint8Array(apduDataLen)
      apduData[0x03] = padNum & 0xFF
      copy(this._commKey.sKeyCount, 0, apduData, 0x04, 0x04)
      copy(encryptedApdu, 0, apduData, 0x08)

      let encApduHead = new Uint8Array(D.toBuffer('8033534D000000'))
      encApduHead[0x04] = (apduDataLen >> 16) & 0xFF
      encApduHead[0x05] = (apduDataLen >> 8) & 0xFF
      encApduHead[0x06] = apduDataLen & 0xFF
      let encApdu = concat(encApduHead, apduData)
      return encApdu
    }

    let decryptResponse = (response) => {
      let decResponse = des112(false, response, this._commKey.sKey)

      let responseView = new Uint8Array(decResponse)
      let viewLength = responseView.length
      let result = (responseView[viewLength - 2] << 8) + responseView[viewLength - 1]
      this._checkSw1Sw2(result)
      return slice(decResponse, 0, -2)
    }

    // a simple lock to guarantee apdu order
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true

    if (typeof apdu === 'string') {
      apdu = D.toBuffer(apdu)
    }
    try {
      console.log('send apdu', D.toHex(apdu), 'isEnc', isEnc)
      if (isEnc) {
        await this._doHandShake()
        apdu = makeEncApdu(apdu)
        console.debug('send enc apdu', D.toHex(apdu))
      }
      let response = await this._sendApdu(apdu)
      if (isEnc) {
        console.debug('got enc response', D.toHex(response), 'isEnc', isEnc)
        response = decryptResponse(response)
      }
      console.log('got response', D.toHex(response), 'isEnc', isEnc)
      return response
    } catch (e) {
      throw e
    } finally {
      this.busy = false
    }
  }

  async _sendApdu (apdu) {
    let {result, response} = await this._transmit(apdu)

    // 6AA6 means busy, send 00A6000008 immediately to get response
    while (result === 0x6AA6) {
      console.debug('got 0xE0616AA6, resend apdu')
      let {_result, _response} = this._transmit(D.toBuffer('00A6000008'))
      response = concat(response, _response)
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      console.debug('got 0x61XX, get remain data')
      let rApdu = D.toBuffer('00C0000000')
      new Uint8Array(rApdu)[0x04] = result & 0xFF
      let {_result, _response} = this._transmit(rApdu)
      response = concat(response, _response)
      result = _result
    }
    this._checkSw1Sw2(result)

    return response
  }

  // noinspection JSMethodCanBeStatic
  _checkSw1Sw2 (sw1sw2) {
    if (sw1sw2 === 0x9000) return
    if (sw1sw2 === 0x6FF8) throw D.error.userCancel
    if ((sw1sw2 & 0xFFF0) === 0x63C0) throw D.error.pinError
    console.warn('sw1sw2 error', sw1sw2.toString(16))
    throw D.error.deviceProtocol
  }

  async _transmit (apdu) {
    if (typeof apdu === 'string') {
      apdu = D.toBuffer(apdu)
    }
    // HID command format: u1PaddingNum 04 pu1Send[u4SendLen] Padding
    let packHidCmd = (apdu) => {
      // additional length of {u1PaddingNum 04}
      let reportId = 0x00
      let reportSize = apdu.byteLength + 0x03
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
        reportSize += 0x110
      } else if (reportSize <= 0x410) {
        reportSize -= 0x210
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

      let padNum = reportSize - apdu.byteLength - 0x03
      // don't set feature id in hid command, chrome.hid will add it automatically to the head
      let packView = new Uint8Array(reportSize - 0x01)
      packView[0x00] = padNum
      packView[0x01] = 0x04 // opCode
      packView.set(new Uint8Array(apdu), 0x02)

      let pack = packView.buffer
      return {reportId, pack}
    }

    // HID response format: u1ReportId u1PaddingNum 04 RESPONSE SW1 SW2 Padding[PaddingNum]
    let unpackHidCmd = (response) => {
      let resView = new Uint8Array(response)
      if (resView[0x02] !== 0x04) {
        console.warn('opCode != 0x04 not supported', D.toHex(resView))
        throw D.error.deviceComm
      }

      let throwLengthError = () => {
        console.warn('unpackHidCmd hid response length incorrect', resView)
        throw D.error.deviceComm
      }

      // get report size from report id
      let reportSize
      if (resView[0x00] <= 0x22) {
        reportSize = resView[0x00] * 0x08
        if (resView[0x01] > 0x07) throw throwLengthError()
      } else if (resView[0x00] <= 0x26) {
        reportSize = 0x110 + (resView[0x00] - 0x22) * 0x40
        if (resView[0x01] > 0x3F) throw throwLengthError()
      } else if (resView[0x00] <= 0x2A) {
        reportSize = 0x210 + (resView[0x00] - 0x26) * 0x80
        if (resView[0x01] > 0x7F) throw throwLengthError()
      } else {
        reportSize = 0x410 + (resView[0x00] - 0x2A) * 0x100
      }

      if (reportSize < (resView[0x01] + 0x03)) throw throwLengthError()
      reportSize -= (resView[0x01] + 0x03)
      if (reportSize < 0x02) throwLengthError()
      reportSize -= 0x02

      response = slice(response, 3, 3 + reportSize)
      let result = (resView[0x03 + reportSize] << 8) + resView[0x04 + reportSize]
      return {result, response}
    }

    let sendAndReceive = async (reportId, pack) => {
      await this._device.send(reportId, pack)
      while (true) {
        let received = await this._device.receive()
        let receivedView = new Uint8Array(received)
        if (receivedView[0x00] !== 0x00 && receivedView[0x02] === 0x00) {
          if (receivedView[0x07] === 0x60) {
            if (receivedView[0x05] === 0x02) {
              // 01 00 00 00 00 02 xx 60: delay xx seconds before get response again
              let delayMills = receivedView[0x06] * 1000 + 100 // additional 100ms
              console.debug(`device busy 02, delay ${delayMills} and resend`)
              await D.wait(delayMills)
              continue
            } else if (receivedView[0x05] === 0x03) {
              // 01 00 00 00 00 03 xx 60: delay xx * 5 millseconds before get response again
              let delayMills = receivedView[0x06] * 5
              console.debug(`device busy 03, delay ${delayMills} and resend`)
              await D.wait(delayMills)
              continue
            }
          } else if (receivedView[0x07] === 0x00) {
            // 01 00 00 00 00 00 xx 00: showing control
            // key will disconnect after long time idle, in this case device will return 0x86 and then return 0x6ff2
            if (receivedView[0x06] !== 0x86) {
              throw D.error.needPressKey
            }
          }
        }
        return received
      }
    }

    console.debug('transmit send apdu', D.toHex(apdu))
    let {reportId, pack} = packHidCmd(apdu)
    let received = await sendAndReceive(reportId, pack)
    let response = unpackHidCmd(received)
    console.debug('transmit got response', response.result.toString(16), D.toHex(response.response))
    return response
  }
}
