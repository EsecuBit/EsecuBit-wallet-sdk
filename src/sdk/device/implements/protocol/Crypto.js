import {Buffer} from 'buffer'
import CryptoJS from 'crypto-js'

let sha1 = (data) => {
  if (typeof data === 'string') {
    data = Buffer.from(data, 'hex')
  }
  let input = CryptoJS.lib.WordArray.create(data)
  let plaintext = CryptoJS.SHA1(input)
  return Buffer.from(plaintext.toString(), 'hex')
}

let des112 = (isEnc, data, key, padding = false) => {
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

export {sha1, des112}
