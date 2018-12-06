import {Buffer} from 'buffer'
import D from '../../../D'
import Provider from '../../../Provider'

const factoryPubKey = '30819f300d06092a864886f70d010101050003818d0030818902818100b721a1039865abb07039aca0bc541fbe1a4c3ff707619f68fccd1f59cacc39d2310a5ba1e8b39e179e552e97b305854c0276e356afe06ed6fd9a1969fe9b3ebc9889a5c5f00498449fa41ee12fb3be2140f3daffbf4075ecdf8c04df343bb85347d39c6b7739dfd5ad81bb2e09adcdc17959a89e7617e297b0aeb6dfa084e5e10203010001'

export default class HandShake {
  constructor (encKey) {
    this._encKey = encKey && encKey.slice(0, 0x10)
    this._crypto = Provider.Crypto
  }

  /**
   * handshake using rsa and 3DES112
   */
  async generateHandshakeApdu () {
    this.isFinished = false
    this._sKey = null
    this._sKeyCount = null

    console.log('start hand shake')
    let tempKeyPair = await this._crypto.generateRsaKeyPair()
    console.debug('tempKeyPair', tempKeyPair)

    let apdu = Buffer.allocUnsafe(0x8B)
    Buffer.from('80334B4E00008402000000', 'hex').copy(apdu)
    let n = this._crypto.getNFromPublicKey(tempKeyPair.publicKey)
    n.copy(apdu, 0x0B)
    return {tempKeyPair, apdu}
  }

  async parseHandShakeResponse (response, tempKeyPair, apdu) {
    let {sKey, sKeyCount} = await this._parseHandShakeResponse(tempKeyPair, response, apdu)
    if (this._encKey) {
      sKey = await this._crypto.des112(false, sKey, this._encKey)
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

    if (response.length - modLen < 0) {
      console.warn('handshake apdu response length invalid, length: ', response.length)
      throw D.error.handShake
    }
    let recvNoSign = Buffer.allocUnsafe(response.length - modLen)
    response.copy(recvNoSign, 0, 0, response.length - modLen)

    let devCert = response.slice(0, modLen)
    let encSKey = response.slice(modLen, modLen * 2)
    let devSign = response.slice(modLen * 2, modLen * 3)
    console.debug('devCert', devCert.toString('hex'))
    console.debug('encSKey', encSKey.toString('hex'))
    console.debug('devSign', devSign.toString('hex'))

    // verify device cert by ca public key(factoryKey)
    let decDevCert = await this._crypto.rsaEncrypt(factoryPubKey, devCert)
    if (!decDevCert) {
      console.warn('decrypted device cert encrypt failed')
      throw D.error.handShake
    }
    console.debug('decDevCert', decDevCert.toString('hex'))
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
    let decSKey = await this._crypto.rsaDecrypt(hostKey.privateKey, encSKey)
    if (!decSKey) {
      console.warn('decrypted enc skey failed', encSKey.toString('hex'))
      throw D.error.handShake
    }
    console.debug('decSKey', decSKey.toString('hex'))
    let orgSKey = removePadding(decSKey)

    devPubKey = Buffer.concat([devPubKey, orgSKey.slice(0, 46)])

    let devPubSha1 = await this._crypto.sha1(devPubKey)
    if (devPubSha1.toString('hex') !== devPubHash.toString('hex')) {
      console.warn('sha1(devPubKey) != debPubHash', devPubKey.toString('hex'), devPubHash.toString('hex'))
      throw D.error.handShake
    }

    let sKeyCount = orgSKey.slice(46, 50)
    let sKey = orgSKey.slice(50, 66)

    // verify device sign by device public key(devPubKey)
    devPubKey = buildPemPublicKeyHex(devPubKey)
    let orgDevSign = await this._crypto.rsaEncrypt(devPubKey, devSign)
    if (!orgDevSign) {
      console.warn('device signature encrypt failed')
      throw D.error.handShake
    }
    console.debug('orgDevSign', orgDevSign.toString('hex'))
    orgDevSign = removePadding(orgDevSign)

    let hashOrgValue = Buffer.concat([apdu.slice(7), devCert, encSKey])
    let hashResult = await this._crypto.sha1(hashOrgValue)

    let toSign = Buffer.concat([oidSha1, hashResult])
    if (toSign.toString('hex') !== orgDevSign.toString('hex')) {
      console.warn('sign data not match')
      throw D.error.handShake
    }
    return {sKey, sKeyCount}
  }

  async encApdu (apdu) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let encryptedApdu = await this._crypto.des112(true, apdu, this._sKey, true)

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

  async decResponse (response) {
    if (!this.isFinished) {
      console.warn('HandShake not handshake yet')
      throw D.error.handShake
    }

    let decResponse = await this._crypto.des112(false, response, this._sKey, true)

    let length = decResponse.length
    let result = (decResponse[length - 2] << 8) + decResponse[length - 1]
    return {
      result: result,
      response: decResponse.slice(0, -2)
    }
  }
}
