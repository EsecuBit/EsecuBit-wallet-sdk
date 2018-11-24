import {sm2} from 'sm.js'
import D from '../../../D'
import {des112} from '../transmitter/Crypto'

const factoryPubKey = '284F6A1A1479FADB063452ED3060CD98A34583BB448954990C239EEC414A41C5A076705E52BC4F6297F667938F99D05C3994834E6639E6DF775F45B2310F50F6'

let des112DeriveKey = (rootKey, deriveData) => {
  let sKey = Buffer.allocUnsafe(0x10)
  deriveData.slice(0, 0x08).copy(sKey)
  deriveData.slice(0, 0x08).copy(sKey, 0x08)
  for (let i = 0x08; i < 0x10; i++) {
    sKey[i] = ~sKey[i] & 0xff
  }
  return des112(true, rootKey, sKey)
}

/**
 * Bluetooth self authentication after connected
 */
export default class Authenticate {
  constructor (hostName, transmitter, featureData = null) {
    if (!transmitter || !hostName) {
      console.warn('Authenticate invalid parameters', hostName, transmitter)
    }
    this._hostName = this._makeHostName(hostName)
    this._featureData = featureData
    this._transmitter = transmitter

    console.info('authenticate hostName', this._hostName.toString('hex'))
  }

  _makeHostName (hostName) {
    let hostNameBytes = new TextDecoder('utf8').decode(hostName)
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
    debugger

    let isFirstTime = this._featureData === null
    let random
    if (isFirstTime) {
      let tempKey = new sm2.SM2KeyPair(null, D.getRandomHex(64))
      let pubKey = Buffer.from(tempKey.pubToString().slice(2, 130), 'hex')
      let apdu = Buffer.from('8033000043B44101', 'hex')
      apdu = Buffer.concat([apdu, pubKey])
      let authData = await this._transmitter.sendApdu(apdu, false)
      console.log('authData first time', authData)

      authData = this._parseAuthData(tempKey, apdu, authData)
      random = authData.random
      this._featureData = authData.feature
      console.log('parsed authData first time', authData)
    } else {
      let apdu = Buffer.from('8033000004B4020010', 'hex')
      let authData = await this._transmitter.sendApdu(apdu, false)
      console.log('authData direct connect', authData)

      if (authData.length < 0x11) {
        console.warn('direct connect authData invalid', authData.toString('hex'))
        throw D.error.deviceProtocol
      }
      random = authData.slice(0x01, 0x11)
    }

    let authApdu = Buffer.allocUnsafe(0x33)
    Buffer.from('803300002FB52D', 'hex').copy(authApdu)
    authApdu[0x07] = isFirstTime ? 0x01 : 0x00

    let feature = this._featureData
    feature.slice(0x10, 0x14).copy(authApdu, 0x08)
    let sKey = des112DeriveKey(feature(0x00, 0x10), random.slice(0, 0x08))
    let encData = des112(true, random.slice(0, 0x08), sKey)
    encData.copy(authApdu, 0x08 + 0x04)
    this._hostName.copy(authApdu, 0x08 + 0x04 + 0x08)
    this._authApdu = authApdu

    return feature
  }

  _parseAuthData (tempKey, apdu, authData) {
    // authData: 0100000000 cert(132=0x84) encFeature(116=) signature(64)
    if (authData.length < 4 + 132 + 136 + 64) {
      console.warn('authData invalid length', authData.toString('hex'), this._isFirstTime)
      throw D.error.handShake
    }
    let keyIndex = authData[0]
    let version = authData[1]
    if (keyIndex !== 0 || version !== 0) {
      console.warn('wrong auth data index or version', keyIndex, version)
    }

    let cert = authData.slice(4, 136)
    let encFeature = authData.slice(136, 272)
    let signature = authData.slice(272, 336)

    // verify cert and get cert public key
    let factoryKey = new sm2.SM2KeyPair(factoryPubKey)
    if (!factoryKey.verify(cert.slice(0, 0x44), cert.slice(0x44, 0x64), cert.slice(0x64, 0x84))) {
      console.warn('authenticate cert verify failed')
      throw D.error.handShake
    }
    let certKey = new sm2.SM2KeyPair('04' + cert.slice(0x04, 0x44).toString('hex'))

    // verify device signature
    let devSignMsg = apdu.slice(5, apdu.length) // apdu data
    if (!certKey.verify(devSignMsg, signature.slice(0x00, 0x20), signature.slice(0x20, 0x40))) {
      console.warn('authenticate signature verify failed')
      throw D.error.handShake
    }

    // TODO decrypt feature, C1C3C2
    let plainData = tempKey.decrypt(encFeature)
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
      // sKey(0x10) sessionId(0x04) pairRandom(0x04)
      feature: plainData.slice(0x10, 0x28)
    }
  }

  async auth () {
    if (!this._authApdu) {
      console.warn('no authApdu, call prepareAuth first')
      throw D.error.handShake
    }
    try {
      await this._transmitter.sendApdu(this._authApdu, false)
    } finally {
      this._authApdu = null
    }
  }
}
