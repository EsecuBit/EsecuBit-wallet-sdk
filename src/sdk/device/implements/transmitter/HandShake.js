import {Buffer} from 'buffer'
import D from '../../../D'
import JSEncrypt from './jsencrypt'
import MockDevice from './io/MockDevice'
import {sha1, des112} from './Crypto'

const factoryPubKeyPem = '-----BEGIN PUBLIC KEY-----' +
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3IaEDmGWrsHA5rKC8VB++Gkw/' +
  '9wdhn2j8zR9Zysw50jEKW6Hos54XnlUul7MFhUwCduNWr+Bu1v2aGWn+mz68mIml' +
  'xfAEmESfpB7hL7O+IUDz2v+/QHXs34wE3zQ7uFNH05xrdznf1a2Buy4Jrc3BeVmo' +
  'nnYX4pewrrbfoITl4QIDAQAB' +
  '-----END PUBLIC KEY-----'

export default class HandShake {
  constructor () {
    this._sKey = null
    this._sKeyCount = null
    this.isFinished = false
  }

  /**
   * handshake using rsa and 3DES112
   */
  generateHandshakeApdu () {
    this.isFinished = false
    this._sKey = null
    this._sKeyCount = null

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

    let genHandShakeApdu = () => {
      let tempKeyPair = generateRsa1024KeyPair()
      let apdu = Buffer.allocUnsafe(0x8B)
      Buffer.from('80334B4E00008402000000', 'hex').copy(apdu)
      let n = Buffer.from(tempKeyPair.key.n.toString(16), 'hex')
      n = Buffer.concat([Buffer.alloc(128 - n.length), n])
      n.copy(apdu, 0x0B)
      return {tempKeyPair, apdu}
    }

    console.log('start hand shake')
    return genHandShakeApdu()
  }

  parseHandShakeResponse (response, tempKeyPair, apdu) {
    let modLen = 0x80 // RSA1024
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

      if (response.length - modLen < 0) {
        console.warn('handshake apdu response length invalid, length: ', response.length)
        throw D.error.handShake
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

    let {sKey, sKeyCount} = parseHandShakeResponse(tempKeyPair, response, apdu)
    this._sKey = sKey
    this._sKeyCount = sKeyCount
    this.isFinished = true
    console.log('finish hand shake')
  }

  encApdu (apdu) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let encryptedApdu = des112(true, apdu, this._sKey)

    // 8033 534D Lc    00 00 00 PaddingNum(1) SKeyCount(4) EncApdu
    let padNum = encryptedApdu.length - apdu.length
    let apduDataLen = 4 + this._sKeyCount.length + encryptedApdu.length
    let apduData = Buffer.allocUnsafe(apduDataLen)
    apduData[0x03] = padNum & 0xFF
    this._sKeyCount.copy(apduData, 0x04)
    encryptedApdu.copy(apduData, 0x08)

    let encApduHead = Buffer.from('8033534D000000', 'hex')
    encApduHead[0x04] = (apduDataLen >> 16) & 0xFF
    encApduHead[0x05] = (apduDataLen >> 8) & 0xFF
    encApduHead[0x06] = apduDataLen & 0xFF
    return Buffer.concat([encApduHead, apduData])
  }

  decResponse (response) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let decResponse = des112(false, response, this._sKey)

    let length = decResponse.length
    let result = (decResponse[length - 2] << 8) + decResponse[length - 1]
    return {
      result: result,
      response: decResponse.slice(0, -2)
    }
  }
}
