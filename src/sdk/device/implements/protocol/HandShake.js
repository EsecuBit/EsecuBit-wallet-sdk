import {Buffer} from 'buffer'
import D from '../../../D'
import Provider from '../../../Provider'

const factoryRSA1024PubKey = '30819f300d06092a864886f70d010101050003818d0030818902818100b721a1039865abb07039aca0bc541fbe1a4c3ff707619f68fccd1f59cacc39d2310a5ba1e8b39e179e552e97b305854c0276e356afe06ed6fd9a1969fe9b3ebc9889a5c5f00498449fa41ee12fb3be2140f3daffbf4075ecdf8c04df343bb85347d39c6b7739dfd5ad81bb2e09adcdc17959a89e7617e297b0aeb6dfa084e5e10203010001'
const factorySM2PubKey = '04284F6A1A1479FADB063452ED3060CD98A34583BB448954990C239EEC414A41C5A076705E52BC4F6297F667938F99D05C3994834E6639E6DF775F45B2310F50F6'
const oidSha1 = Buffer.from('3021300906052b0e03021a05000414', 'hex')

const RSA1024 = 'rsa1024'
const SM2 = 'sm2'

export default class HandShake {
  constructor (encKey, mode = RSA1024) {
    if (mode !== RSA1024 && mode !== SM2) {
      throw D.error.invalidParams
    }

    this._encKey = encKey && encKey.slice(0, 0x10)
    this._crypto = Provider.Crypto
    this._mode = mode
  }

  /**
   * handshake using rsa and 3DES112
   */
  async generateHandshakeApdu () {
    this.isFinished = false
    this._sKey = null
    this._sKeyCount = null

    console.log('start hand shake', this._mode)
    if (this._mode === RSA1024) {
      let tempKeyPair = await this._crypto.generateRsaKeyPair()
      console.debug('tempKeyPair', tempKeyPair)

      let apdu = Buffer.allocUnsafe(0x8B)
      Buffer.from('80334B4E00008402000000', 'hex').copy(apdu)
      let n = this._crypto.getNFromPublicKey(tempKeyPair.publicKey)
      n.copy(apdu, 0x0B)
      return {tempKeyPair, apdu}
    } else if (this._mode === SM2) {
      let tempKeyPair = await this._crypto.generateSM2KeyPair()
      console.debug('tempKeyPair', tempKeyPair)

      let apdu = Buffer.allocUnsafe(0x49)
      Buffer.from('80334B4E4402010008', 'hex').copy(apdu)
      Buffer.from(tempKeyPair.publicKey.slice(0x02, 0x82), 'hex').copy(apdu, 0x09)
      return {tempKeyPair, apdu}
    }
  }

  async parseHandShakeResponse (response, tempKeyPair, apdu) {
    let {sKey, sKeyCount} = await this._parseHandShakeResponse(tempKeyPair, response, apdu)
    if (this._encKey) {
      if (this._mode === RSA1024) {
        sKey = await this._crypto.des112(false, sKey, this._encKey)
      } else if (this._mode === SM2) {
        // TODO implement for BT
        sKey = await this._crypto.sm4Decrypt(this._encKey, sKey)
      }
    }

    this._sKey = sKey
    this._sKeyCount = sKeyCount
    this.isFinished = true
    console.log('finish hand shake')
  }

  async _parseHandShakeResponse (hostKey, response, apdu) {
    let modLen = 0x80 // RSA1024
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
          throw D.error.handShake
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
      return prefix + publicKey.toString('hex') + '0203010001'
    }

    let devCert
    let encSKey
    let devSign
    if (this._mode === RSA1024) {
      if (response.length - modLen * 3 < 0) {
        console.warn('handshake apdu response length invalid, length: ', response.length)
        throw D.error.handShake
      }

      devCert = response.slice(0, modLen)
      encSKey = response.slice(modLen, modLen * 2)
      devSign = response.slice(modLen * 2, modLen * 3)
    } else if (this._mode === SM2) {
      let length = 0x84 + 0x74 + 0x40
      if (response.length !== length) {
        console.warn('handshare apdu response length invalid, length: ', response.length)
        throw D.error.handShake
      }
      devCert = response.slice(0, 0x84)
      encSKey = response.slice(0x84, 0x84 + 0x74)
      devSign = response.slice(0x84 + 0x74, 0x84 + 0x74 + 0x40)
    }

    console.debug('devCert', devCert.toString('hex'))
    console.debug('encSKey', encSKey.toString('hex'))
    console.debug('devSign', devSign.toString('hex'))

    // 1. decrypt sKey by temp rsa key pair(hostKey)
    let decDevPubKey
    let sKeyCount
    let sKey
    if (this._mode === RSA1024) {
      let decSKey = await this._crypto.rsaDecrypt(hostKey.privateKey, encSKey)
      console.debug('decSKey', decSKey.toString('hex'))
      if (decSKey) {
        let orgSKey = removePadding(decSKey)
        decDevPubKey = orgSKey.slice(0, 46)
        sKeyCount = orgSKey.slice(46, 50)
        sKey = orgSKey.slice(50, 66)
      }
    } else if (this._mode === SM2) {
      let orgSKey = await this._crypto.sm2Decrypt(hostKey.privateKey, encSKey)
      sKeyCount = orgSKey.slice(0, 4)
      sKey = orgSKey.slice(4, 20)
    }
    if (!sKey) {
      console.warn('decrypted enc skey failed', encSKey.toString('hex'))
      throw D.error.handShake
    }
    console.debug('sKey', sKey.toString('hex'), sKeyCount.toString('hex'), decDevPubKey && decDevPubKey.toString('hex'))

    // 2. verify device cert by factory public key, and recover device public key
    let devPubKey
    if (this._mode === RSA1024) {
      let decDevCert = await this._crypto.rsaEncrypt(factoryRSA1024PubKey, devCert)
      if (!decDevCert) {
        console.warn('decrypted device cert encrypt failed')
        throw D.error.handShake
      }
      console.debug('decDevCert', decDevCert.toString('hex'))
      let orgDevCert = removePadding(decDevCert)

      if (orgDevCert.slice(0, 15).toString('hex') !== oidSha1.toString('hex')) {
        console.warn('decrypted device cert oid != sha1 ', orgDevCert.toString('hex'))
        throw D.error.handShake
      }

      let tempLen = modLen - 0x2E
      let devPubHash = orgDevCert.slice(15, 35)
      devPubKey = orgDevCert.slice(35, 35 + tempLen)
      devPubKey = Buffer.concat([devPubKey, decDevPubKey])

      let devPubSha1 = await this._crypto.sha1(devPubKey)
      if (devPubSha1.toString('hex') !== devPubHash.toString('hex')) {
        console.warn('sha1(devPubKey) != devPubHash', devPubKey.toString('hex'), devPubHash.toString('hex'))
        throw D.error.handShake
      }
    } else if (this._mode === SM2) {
      let result = await this._crypto.sm2VerifyRaw(factorySM2PubKey, devCert.slice(0, 0x44),
        devCert.slice(0x44, 0x64), devCert.slice(0x64, 0x84))
      if (!result) {
        console.warn('decrypted device cert encrypt failed')
        throw D.error.handShake
      }
      devPubKey = devCert.slice(0x04, 0x44)
    }

    // 3. verify device sign by device public key(devPubKey)
    let apduData = this._mode === RSA1024 ? apdu.slice(7) : apdu.slice(5)
    let hashOrgValue = Buffer.concat([apduData, devCert, encSKey])
    if (this._mode === RSA1024) {
      devPubKey = buildPemPublicKeyHex(devPubKey)
      let orgDevSign = await this._crypto.rsaEncrypt(devPubKey, devSign)
      if (!orgDevSign) {
        console.warn('device signature encrypt failed')
        throw D.error.handShake
      }
      console.debug('orgDevSign', orgDevSign.toString('hex'))
      orgDevSign = removePadding(orgDevSign)
      let hashResult = await this._crypto.sha1(hashOrgValue)

      let toSign = Buffer.concat([oidSha1, hashResult])
      if (toSign.toString('hex') !== orgDevSign.toString('hex')) {
        console.warn('sign data not match')
        throw D.error.handShake
      }
    } else if (this._mode === SM2) {
      // let hashResult = await this._crypto.sm3(hashOrgValue)
      let devPubKeyHex = '04' + devPubKey.toString('hex')
      let result = this._crypto.sm2VerifyRaw(devPubKeyHex, hashOrgValue, devSign.slice(0, 0x20), devSign.slice(0x20, 0x40))
      if (!result) {
        console.warn('sign data verify failed')
        throw D.error.handShake
      }
    }

    return {sKey, sKeyCount}
  }

  async encApdu (apdu) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let encryptedApdu
    if (this._mode === RSA1024) {
      encryptedApdu = await this._crypto.des112(true, apdu, this._sKey, true)
    } else if (this._mode === SM2) {
      encryptedApdu = await this._crypto.sm4Encrypt(this._sKey, apdu)
    }

    // 8033 534D Lc 00 00 00 PaddingNum(1) SKeyCount(4) EncApdu
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

  async decResponse (response) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let decResponse = await this._crypto.des112(false, response, this._sKey, true)
    if (this._mode === RSA1024) {
      decResponse = await this._crypto.des112(false, response, this._sKey, true)
    } else if (this._mode === SM2) {
      decResponse = await this._crypto.sm4Decrypt(this._sKey, response)
    }
    console.warn('??? 1', decResponse.toString('hex'))

    let length = decResponse.length
    let result = (decResponse[length - 2] << 8) + decResponse[length - 1]
    console.warn('??? 2', decResponse.slice(0, -2).toString('hex'), result)
    return {
      result: result,
      response: decResponse.slice(0, -2)
    }
  }
}
HandShake.RSA1024 = RSA1024
HandShake.SM2 = SM2
