
import D from '../D'
import MockDevice from './MockDevice'
import JSEncrypt from './jsencrypt'
import CryptoJS from 'crypto-js'
import ChromeHidDevice from './ChromeHidDevice'

const factoryPubKeyPem = '-----BEGIN PUBLIC KEY-----' +
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3IaEDmGWrsHA5rKC8VB++Gkw/' +
  '9wdhn2j8zR9Zysw50jEKW6Hos54XnlUul7MFhUwCduNWr+Bu1v2aGWn+mz68mIml' +
  'xfAEmESfpB7hL7O+IUDz2v+/QHXs34wE3zQ7uFNH05xrdznf1a2Buy4Jrc3BeVmo' +
  'nnYX4pewrrbfoITl4QIDAQAB' +
  '-----END PUBLIC KEY-----'

let sha1 = (data) => {
  if (typeof data === 'string') {
    data = Buffer.from(data, 'hex')
  }
  let input = CryptoJS.lib.WordArray.create(data)
  let plaintext = CryptoJS.SHA1(input)
  return Buffer.from(plaintext.toString(), 'hex')
}

let des112 = (isEnc, data, key) => {
  let customPadding = (data) => {
    let padNum = 8 - data.length % 8
    let padding = Buffer.alloc(padNum)
    padding[0] = 0x80
    return Buffer.concat([data, padding])
  }

  let removeCustomPadding = (data) => {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'hex')
    }
    let padNum = data[0]
    return data.slice(1, data.length - padNum)
  }

  if (typeof data === 'string') {
    data = Buffer.from(data, 'hex')
  }
  if (typeof key === 'string') {
    key = Buffer.from(key, 'hex')
  }

  if (isEnc) {
    data = customPadding(data)
  }
  let des168Key = Buffer.concat([key, key.slice(0, 8)]) // des112 => des 168
  let input = CryptoJS.lib.WordArray.create(data)
  let pass = CryptoJS.lib.WordArray.create(des168Key)
  if (isEnc) {
    let encData = CryptoJS.TripleDES.encrypt(input, pass, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    })
    return Buffer.from(encData.ciphertext.toString(CryptoJS.enc.Hex), 'hex')
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
export default class HidTransmitter {
  constructor () {
    this._device = D.test.mockDevice ? new MockDevice() : new ChromeHidDevice()
    this._commKey = {
      sKey: null,
      generated: false
    }

    this._plugListener = () => {}
    this._device.listenPlug((error, status) => {
      if (status === D.status.plugOut) {
        this._commKey = {
          sKey: null,
          generated: false
        }
      }
      D.dispatch(() => this._plugListener(error, status))
    })
  }

  listenPlug (callback) {
    if (callback) this._plugListener = callback
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
      let apdu = Buffer.allocUnsafe(0x8B)
      Buffer.from('80334B4E00008402000000', 'hex').copy(apdu)
      let n = Buffer.from(tempKeyPair.key.n.toString(16), 'hex')
      n = Buffer.concat([Buffer.alloc(128 - n.length), n])
      n.copy(apdu, 0x0B)
      return {tempKeyPair, apdu}
    }

    let parseHandShakeResponse = (hostKey, response, apdu) => {
      let removePadding = (data) => {
        let pos = 0
        if (data[pos++] !== 0x00) {
          console.warn('decrypted device cert invalid padding, dataView[0] != 0x00', data.toString('hex'))
          throw D.error.handShake
        }
        let type = data[pos++]
        while (data[pos]) {
          if (type === 0x01 && data[pos] !== 0xFF) {
            console.warn('decrypted device cert invalid padding, type === 0x01 but dataView[0] != 0xFF', data.toString('hex'))
          }
          pos++
        }
        if (data[pos++] !== 0x00) {
          console.warn('decrypted device cert invalid padding dataView[last_padding] != 0x00', data.toString('hex'))
          throw D.error.handShake
        }
        return data.slice(pos)
      }

      let buildPemPublicKeyHex = (publicKey) => {
        let firstBit = publicKey[0] & 0x80
        let prefix = firstBit
          ? '30819f300d06092a864886f70d010101050003818d0030818902818100'
          : '30819e300d06092a864886f70d010101050003818c00308188028180'
        prefix = Buffer.from(prefix, 'hex')
        return Buffer.concat([prefix, publicKey, Buffer.from('0203010001', 'hex')])
      }

      let recvNoSign = Buffer.allocUnsafe(response.length - modLen)
      response.copy(recvNoSign, 0, 0, response.length - modLen)
      let factoryKey = new JSEncrypt()
      factoryKey.setPublicKey(factoryPubKeyPem)

      let devCert = response.slice(0, modLen)
      let encSKey = response.slice(modLen, modLen * 2)
      let devSign = response.slice(modLen * 2, modLen * 3)

      // verify device cert by ca public key(factoryKey)
      let decDevCert = factoryKey.encrypt(devCert.toString('hex'))
      if (!decDevCert) {
        console.warn('decrypted device cert encrypt failed')
        throw D.error.handShake
      }
      decDevCert = Buffer.from(decDevCert, 'hex')
      let orgDevCert = removePadding(decDevCert)

      const oidSha1 = Buffer.from('3021300906052b0e03021a05000414', 'hex')
      if (orgDevCert.slice(0, 15).toString('hex') !== oidSha1.toString('hex')) {
        console.warn('decrypted device cert oid != sha1 ', orgDevCert.toString('hex'))
        throw D.error.handShake
      }

      let tempLen = modLen - 0x2E
      let devPubHash = orgDevCert.slice(15, 35)
      let devPubKey = orgDevCert.slice(35, 35 + tempLen)

      // decrypt sKey by temp rsa key pair(hostKey)
      let decSKey = hostKey.decrypt(encSKey.toString('hex'))
      if (!decSKey) {
        console.warn('decrypted enc skey failed', encSKey.toString('hex'))
        throw D.error.handShake
      }
      decSKey = Buffer.from(decSKey, 'hex')
      let orgSKey = removePadding(decSKey)

      devPubKey = Buffer.concat([devPubKey, orgSKey.slice(0, 46)])

      let devPubSha1 = sha1(devPubKey)
      if (devPubSha1.toString('hex') !== devPubHash.toString('hex')) {
        console.warn('sha1(devPubKey) != debPubHash', devPubKey.toString('hex'), devPubHash.toString('hex'))
        throw D.error.handShake
      }

      let sKeyCount = orgSKey.slice(46, 50)
      let sKey = orgSKey.slice(50, 66)

      // verify device sign by device public key(devPubKey)
      devPubKey = buildPemPublicKeyHex(devPubKey)
      let devPubKeyObj = new JSEncrypt()
      devPubKeyObj.setPublicKey(devPubKey.toString('hex'))
      let orgDevSign = devPubKeyObj.encrypt(devSign.toString('hex'))
      if (!orgDevSign) {
        console.warn('device signature encrypt failed')
        throw D.error.handShake
      }
      orgDevSign = Buffer.from(orgDevSign, 'hex')
      orgDevSign = removePadding(orgDevSign)

      let hashOrgValue = Buffer.concat([apdu.slice(7), devCert, encSKey])
      let hashResult = sha1(hashOrgValue)

      let toSign = Buffer.concat([oidSha1, hashResult])
      if (toSign.toString('hex') !== orgDevSign.toString('hex')) {
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

      // 8033 534D Lc    00 00 00 PaddingNum(1) SKeyCount(4) EncApdu
      let padNum = encryptedApdu.length - apdu.length
      let apduDataLen = 4 + this._commKey.sKeyCount.length + encryptedApdu.length
      let apduData = Buffer.allocUnsafe(apduDataLen)
      apduData[0x03] = padNum & 0xFF
      this._commKey.sKeyCount.copy(apduData, 0x04)
      encryptedApdu.copy(apduData, 0x08)

      let encApduHead = Buffer.from('8033534D000000', 'hex')
      encApduHead[0x04] = (apduDataLen >> 16) & 0xFF
      encApduHead[0x05] = (apduDataLen >> 8) & 0xFF
      encApduHead[0x06] = apduDataLen & 0xFF
      return Buffer.concat([encApduHead, apduData])
    }

    let decryptResponse = (response) => {
      let decResponse = des112(false, response, this._commKey.sKey)

      let length = decResponse.length
      let result = (decResponse[length - 2] << 8) + decResponse[length - 1]
      this._checkSw1Sw2(result)
      return decResponse.slice(0, -2)
    }

    // a simple lock to guarantee apdu order
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true

    if (typeof apdu === 'string') {
      apdu = Buffer.from(apdu, 'hex')
    }
    try {
      console.log('send apdu', apdu.toString('hex'), 'isEnc', isEnc)
      if (isEnc) {
        await this._doHandShake()
        apdu = makeEncApdu(apdu)
        console.debug('send enc apdu', apdu.toString('hex'))
      }
      let response = await this._sendApdu(apdu)
      if (isEnc) {
        console.debug('got enc response', response.toString('hex'), 'isEnc', isEnc)
        response = decryptResponse(response)
      }
      console.log('got response', response.toString('hex'), 'isEnc', isEnc)
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
      let {_result, _response} = this._transmit(Buffer.from('00A6000008'), 'hex')
      response = Buffer.concat([response, _response])
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      console.debug('got 0x61XX, get remain data')
      let rApdu = Buffer.from('00C0000000', 'hex')
      rApdu[0x04] = result & 0xFF
      let {_result, _response} = this._transmit(rApdu)
      response = Buffer.concat([response, _response])
      result = _result
    }
    this._checkSw1Sw2(result)

    return response
  }

  // noinspection JSMethodCanBeStatic
  _checkSw1Sw2 (sw1sw2) {
    if (sw1sw2 === 0x9000) return
    if (sw1sw2 === 0x6FF8) throw D.error.userCancel
    if (sw1sw2 === 0x6FF9) throw D.error.operationTimeout
    if ((sw1sw2 & 0xFFF0) === 0x63C0) throw D.error.pinError
    console.warn('sw1sw2 error', sw1sw2.toString(16))
    throw D.error.deviceProtocol
  }

  async _transmit (apdu) {
    if (typeof apdu === 'string') {
      apdu = Buffer.from(apdu, 'hex')
    }
    // HID command format: u1PaddingNum 04 pu1Send[u4SendLen] Padding
    let packHidCmd = (apdu) => {
      // additional length of {u1PaddingNum 04}
      let reportId = 0x00
      let reportSize = apdu.length + 0x03
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

      let padNum = reportSize - apdu.length - 0x03
      // don't set feature id in hid command, chrome.hid will add it automatically to the head
      let pack = Buffer.alloc(reportSize - 0x01)
      pack[0x00] = padNum
      pack[0x01] = 0x04 // opCode
      apdu.copy(pack, 0x02)
      return {reportId, pack}
    }

    // HID response format: u1ReportId u1PaddingNum 04 RESPONSE SW1 SW2 Padding[PaddingNum]
    let unpackHidCmd = (response) => {
      if (response[0x02] !== 0x04) {
        console.warn('opCode != 0x04 not supported', response.toString('hex'))
        throw D.error.deviceComm
      }

      let throwLengthError = () => {
        console.warn('unpackHidCmd hid response length incorrect', response)
        throw D.error.deviceComm
      }

      // get report size from report id
      let reportSize
      if (response[0x00] <= 0x22) {
        reportSize = response[0x00] * 0x08
        if (response[0x01] > 0x07) throw throwLengthError()
      } else if (response[0x00] <= 0x26) {
        reportSize = 0x110 + (response[0x00] - 0x22) * 0x40
        if (response[0x01] > 0x3F) throw throwLengthError()
      } else if (response[0x00] <= 0x2A) {
        reportSize = 0x210 + (response[0x00] - 0x26) * 0x80
        if (response[0x01] > 0x7F) throw throwLengthError()
      } else {
        reportSize = 0x410 + (response[0x00] - 0x2A) * 0x100
      }

      if (reportSize < (response[0x01] + 0x03)) throw throwLengthError()
      reportSize -= (response[0x01] + 0x03)
      if (reportSize < 0x02) throwLengthError()
      reportSize -= 0x02

      let result = (response[0x03 + reportSize] << 8) + response[0x04 + reportSize]
      response = response.slice(3, 3 + reportSize)
      return {result, response}
    }

    let sendAndReceive = async (reportId, pack) => {
      await this._device.send(reportId, pack)
      while (true) {
        let received = await this._device.receive()
        if (received[0x00] !== 0x00 && received[0x02] === 0x00) {
          if (received[0x07] === 0x60) {
            if (received[0x05] === 0x02) {
              // 01 00 00 00 00 02 xx 60: delay xx seconds before get response again
              let delayMills = received[0x06] * 1000 + 100 // additional 100ms
              console.debug(`device busy 02, delay ${delayMills} and resend`)
              await D.wait(delayMills)
              continue
            } else if (received[0x05] === 0x03) {
              // 01 00 00 00 00 03 xx 60: delay xx * 5 millseconds before get response again
              let delayMills = received[0x06] * 5
              console.debug(`device busy 03, delay ${delayMills} and resend`)
              await D.wait(delayMills)
              continue
            }
          } else if (received[0x07] === 0x00) {
            // 01 00 00 00 00 00 xx 00: showing control
            // key will disconnect after long time idle, in this case device will return 0x86 and then return 0x6ff2
            if (received[0x06] !== 0x86) {
              throw D.error.needPressKey
            }
          }
        }
        return received
      }
    }

    console.debug('transmit send apdu', apdu.toString('hex'))
    let {reportId, pack} = packHidCmd(apdu)
    let received = await sendAndReceive(reportId, pack)
    let response = unpackHidCmd(received)
    console.debug('transmit got response', response.result.toString(16), response.response.toString('hex'))
    return response
  }
}
