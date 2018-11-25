import {sm2} from 'sm.js'
import D from '../../../D'
import {des112} from './Crypto'

const factoryPubKey = '04284F6A1A1479FADB063452ED3060CD98A34583BB448954990C239EEC414A41C5A076705E52BC4F6297F667938F99D05C3994834E6639E6DF775F45B2310F50F6'

let des112DeriveKey = (rootKey, deriveData) => {
  let sKey = Buffer.allocUnsafe(0x10)
  deriveData.slice(0, 0x08).copy(sKey)
  deriveData.slice(0, 0x08).copy(sKey, 0x08)
  for (let i = 0x08; i < 0x10; i++) {
    sKey[i] = ~sKey[i] & 0xff
  }
  return des112(true, sKey, rootKey)
}

/**
 * Bluetooth self authentication after connected
 */
export default class Authenticate {
  constructor (hostName, sender, featureData = null) {
    if (!sender || !hostName) {
      console.warn('Authenticate invalid parameters', hostName, sender)
    }
    this._hostName = Authenticate._makeHostName(hostName)
    this._featureData = featureData
    this._sender = sender
  }

  static _makeHostName (hostName) {
    let hostNameBytes = D.strToUtf8(hostName)
    if (hostNameBytes <= 0x20) {
      return hostNameBytes
    }
    let index = 0x1F
    while (index > 0) {
      if ((hostNameBytes[index] & 0x80) === 0) break
      if ((hostNameBytes[index] & 0xC0) === 0xC0) break
      if ((hostNameBytes[index] & 0xC0) === 0) index--
    }
    return hostNameBytes.slice(0, index)
  }

  async prepareAuth () {
    console.info('authenticate hostName', this._hostName.toString('hex'))

    let isFirstTime = this._featureData === null
    let random
    if (isFirstTime) {
      let tempKey = sm2.genKeyPair()
      console.log('tempKey', tempKey.toString())
      let pubKey = Buffer.from(tempKey.pubToString().slice(2, 130), 'hex')
      let apdu = Buffer.from('8033000043B44101', 'hex')
      apdu = Buffer.concat([apdu, pubKey])
      let authData = await this._sender.sendApdu(apdu, false)
      console.log('authData first time', authData.toString('hex'))

      authData = this._parseAuthData(tempKey, apdu, authData)
      random = authData.random
      this._featureData = authData.feature
      console.log('parsed authData first time', random.toString('hex'), this._featureData.toString('hex'))
    } else {
      let apdu = Buffer.from('8033000004B4020010', 'hex')
      let authData = await this._sender.sendApdu(apdu, false)
      console.log('authData direct connect', authData.toString('hex'))

      if (authData.length < 0x11) {
        console.warn('direct connect authData invalid', authData.toString('hex'))
        throw D.error.deviceProtocol
      }
      random = authData.slice(0x01, 0x11)
    }

    let authApdu = Buffer.allocUnsafe(0x34)
    Buffer.from('803300002FB52D', 'hex').copy(authApdu)
    authApdu[0x07] = isFirstTime ? 0x01 : 0x00

    // feature = sKey(0x10) sessionId(0x04) pairRandom(0x04)
    let feature = this._featureData
    feature.slice(0x10, 0x14).copy(authApdu, 0x08)
    let sKey = des112DeriveKey(feature.slice(0, 0x10), random.slice(0x08, 0x10))
    console.log('derive des key', feature.slice(0, 0x10).toString('hex'), random.slice(0x08, 0x10), sKey.toString('hex'))
    let encData = des112(true, random.slice(0, 0x08), sKey)
    encData.copy(authApdu, 0x08 + 0x04)
    this._hostName.copy(authApdu, 0x08 + 0x04 + 0x08)
    this._authApdu = authApdu

    return isFirstTime ? feature : null
  }

  _parseAuthData (tempKey, apdu, authData) {
    // authData: 0100000000 cert(132=0x84) encFeature(136=0x88) signature(64=0x40)
    if (authData.length < 0x04 + 0x84 + 0x88 + 0x40) {
      console.warn('authData invalid length', authData.toString('hex'), this._isFirstTime)
      throw D.error.handShake
    }
    let keyIndex = authData[0]
    let version = authData[1]
    if (keyIndex !== 1 || version !== 0) {
      console.warn('wrong auth data index or version', keyIndex, version)
    }

    let cert = authData.slice(0x04, 0x88)
    let encFeature = authData.slice(0x88, 0x110)
    let signature = authData.slice(0x110, 0x150)

    // verify cert and get cert public key
    let factoryKey = new sm2.SM2KeyPair(factoryPubKey)
    if (!factoryKey.verifyRaw(Array.prototype.slice.call(cert.slice(0, 0x44), 0),
      cert.slice(0x44, 0x64).toString('hex'), cert.slice(0x64, 0x84).toString('hex'))) {
      console.warn('authenticate cert verify failed', cert.toString('hex'))
      throw D.error.handShake
    }
    let certKey = new sm2.SM2KeyPair('04' + cert.slice(0x04, 0x44).toString('hex'))

    // verify device signature
    let apduData = apdu.slice(0x05, apdu.length)
    let resData = authData.slice(0, authData.length - 0x40)
    let devSignMsg = Array.prototype.slice.call(Buffer.concat([apduData, resData]))
    if (!certKey.verifyRaw(devSignMsg, signature.slice(0, 0x20).toString('hex'), signature.slice(0x20, 0x40).toString('hex'))) {
      console.warn('authenticate signature verify failed')
      throw D.error.handShake
    }

    let plainData = tempKey.decrypt(encFeature)
    plainData = Buffer.from(plainData)
    if (!plainData) {
      console.warn('authenticate decrypt feature failed')
      throw D.error.handShake
    }
    if (plainData.length !== 0x10 + 0x10 + 0x04 + 0x04) {
      console.warn('authenticate feature length invalid', plainData.toString('hex'))
      throw D.error.handShake
    }
    return {
      random: plainData.slice(0, 0x10),
      feature: plainData.slice(0x10, 0x28)
    }
  }

  async auth () {
    if (!this._authApdu) {
      console.warn('no authApdu, call prepareAuth first')
      throw D.error.handShake
    }
    try {
      await this._sender.sendApdu(this._authApdu, false)
    } finally {
      this._authApdu = null
    }
  }
}
