import {Buffer} from 'buffer'
import CryptoJS from 'crypto-js'
import JSEncrypt from './jsencrypt'
import MockDevice from '../transmitter/io/MockDevice'
import D from '../../../D'

export default class Crypto {
  static async sha1 (data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'hex')
    }
    let input = CryptoJS.lib.WordArray.create(data)
    let plaintext = CryptoJS.SHA1(input)
    return Buffer.from(plaintext.toString(), 'hex')
  }

  static async des112 (isEnc, data, key, padding = false) {
    let customPadding = (data) => {
      let padNum = 8 - data.length % 8
      if (padNum === 8) return data

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

    if (isEnc && padding) {
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
      if (padding) {
        return removeCustomPadding(plaintext)
      } else {
        return Buffer.from(plaintext, 'hex')
      }
    }
  }

  static async generateRsaKeyPair (bits = 1024) {
    if (bits !== 1024) {
      console.warn('generateRsaKeyPair not support not 1024 bits yet')
      throw D.error.notImplemented
    }
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
    // noinspection JSAccessibilityCheck
    return {
      privateKey: keyPair.key.getPrivateBaseKey(),
      publicKey: keyPair.key.getPublicBaseKey()
    }
  }

  static async rsaEncrypt (publicKey, data) {
    let key = new JSEncrypt()
    key.setPublicKey(publicKey)
    let encData = key.encrypt(data.toString('hex'))
    return (encData && Buffer.from(encData, 'hex')) || null
  }

  static async rsaDecrypt (privateKey, encData) {
    let key = new JSEncrypt()
    key.setPrivateKey(privateKey)
    let plainData = key.decrypt(encData.toString('hex'))
    return (plainData && Buffer.from(plainData, 'hex')) || null
  }
}
