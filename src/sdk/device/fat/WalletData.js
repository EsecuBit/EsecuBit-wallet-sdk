import Fat from 'src/sdk/device/fat/Fat'
import FatApi from 'src/sdk/device/fat/FatApi'
import D from '../../D'

/**
 * WalletData store data in files. Currently we have two types of files:
 * 1. wallet info, file name "cnw"(coin wallet), only one file
 * 2. account info, file name "cna#coinType#index"(coin account), number of files = number of accounts
 *
 * We using TLV structure to manage files content.
 *
 * TLV structure rules:
 * 1. big-endian
 *
 * 2. tag is a flexible varible and its data of length in TLV:
 * data.length = 1 if tag range = [0x00, 0xdf]
 * data.length = 2 if tag range = [0xf0, 0x0eff], the value of the length will be:
 *    data[0] = (tag >> 8) & 0xff + 0xf0 // range [0xf0, 0xfe]
 *    data[1] = tag & 0xff // range [0x00, 0xff]
 * data.length >= 4 if length > 0x0eff:
 *    data[0] = 0xff
 *    data[1] = tag.length // e.g. 0x123456.length = 3
 *    data[2] = (tag >> ((tag[1] - 1) * 8)) & 0xff
 *    ...
 *    data[tag.length + 1] = tag & 0xff
 *
 * tag != 0, tag = 0 means the end of the TLV
 *
 * 3. length is a flexible varible and its data of length in TLV: (same as tag)
 * data.length = 1 if length range = [0x00, 0xdf]
 * data.length = 2 if length range = [0xf0, 0x0eff], the value of the length will be:
 *    data[0] = (length >> 8) & 0xff + 0xf0 // range [0xf0, 0xfe]
 *    data[1] = length & 0xff // range [0x00, 0xff]
 * data.length >= 4 if length > 0x0eff:
 *    data[0] = 0xff
 *    data[1] = length.length // e.g. 0x123456.length = 3
 *    data[2] = (length >> ((length[1] - 1) * 8)) & 0xff
 *    ...
 *    data[length.length + 1] = length & 0xff
 *
 * 4. value is a flexible varible and value.length = length in TLV
 *
 * file content:
 *
 * cnw: {
 *   walletId: string,
 *   walletName: string
 *   walletDataVersion: int,
 *   account: {
 *    coinType: string,
 *    amount: int
 *   },
 *   account: {
 *    coinType: string,
 *    amount: int
 *   }
 *   ...
 * }
 *
 * cna#btc#1: {
 *   coinType, int
 *   accountIndex: int
 *   accountName: string
 *   accountExternalIndex: int
 *   accountChangeIndex: int
 *   txInfo: {
 *     txId: string,
 *     txComment: comment,
 *   },
 *   txInfo: {
 *     txId: string,
 *     txComment: comment,
 *   },
 *   ...
 * }
 */

const tags = {
  coinWallet: {tag: 0x01, type: 'complex'},
  walletId: {tag: 0x03, type: 'string'},
  walletName: {tag: 0x04, type: 'string'},
  walletDataVersion: {tag: 0x04, type: 'number'},
  account: {tag: 0x11, type: ['array', 'complex']},
  coinType: {tag: 0x12, type: 'string'},
  amount: {tag: 0x013, type: 'number'},

  coinAccount: {tag: 0x41, type: 'complex'},
  accountIndex: {tag: 0x42, type: 'string'},
  accountName: {tag: 0x43, type: 'string'},
  accountDataVersion: {tag: 0x44, type: 'string'},
  accountExchangeIndex: {tag: 0x45, type: 'number'},
  accountChangeIndex: {tag: 0x46, type: 'number'},
  txInfo: {tag: 0x51, type: ['array', 'complex']},
  txId: {tag: 0x52, type: 'string'},
  txComment: {tag: 0x53, type: 'string'}
}
const tagEntries = Object.entries(tags)

const parseTLV = (data) => {
  let object = {}
  const setFieldByTag = function (object, tag, value) {
    let result = tagEntries.find(([field, info]) => info.tag === tag)
    if (result) {
      console.warn('parseTLV found unsupport tag, ignore', tag, value)
      return
    }
    let field = result[0]
    let type = result[1].type

    let actualValue
    if (type.includes('complex')) {
      actualValue = parseTLV(value)
    } else if (type.includes('string')) {
      actualValue = new TextDecoder('utf8').decode(value)
    } else if (type.includes('number')) {
      actualValue = value.readIntLE(0, value.length)
    } else {
      console.warn('parseTLV found unsupport type', field, type)
      throw D.error.unknown
    }

    if (type.includes('array')) {
      if (!this[field]) {
        this[field] = []
      }
      this[field].append(actualValue)
    } else {
      this[field] = actualValue
    }
  }

  try {
    let offset = 0
    while (true) {
      let firstByte = data[offset++]
      let tag
      if (firstByte === 0) {
        console.warn('parseTLV get tag == 0, it is end of the TLV structure. data size != tlv size, it is ok, exist')
        break
      } else if (firstByte < 0xf0) {
        tag = firstByte
      } else if (firstByte < 0xff) {
        let secondByte = data[offset++]
        tag = ((firstByte - 0xf0) << 8) + secondByte
      } else {
        let tagLength = data[offset++]
        tag = 0
        while (tagLength--) {
          tag = (tag << 8) + data[offset++]
        }
      }

      firstByte = data[offset++]
      let length
      if (firstByte < 0xf0) {
        length = firstByte
      } else if (firstByte < 0xff) {
        let secondByte = data[offset++]
        length = ((firstByte - 0xf0) << 8) + secondByte
      } else {
        let lengthLength = data[offset++]
        length = 0
        while (lengthLength--) {
          tag = (tag << 8) + data[offset++]
        }
      }

      let value = data.slice(offset, length)
      setFieldByTag(object, tag, value)
      offset += length
    }
  } catch (e) {
    console.warn('parseTLV failed', data.toString('hex'))
    throw D.error.fatInvalidFile
  }
}

const toTLV = (object) => {
  const getVarLength = (value) => {
    if (value < 0xf0) {
      return 1
    } else if (value < 0x0eff) {
      return 2
    } else {
      let length = 0
      while (value) {
        length++
        value = value >> 8
      }
      return 2 + length
    }
  }

  const setTag = (buffer, offset, tag) => {
    if (tag < 0xf0) {
      buffer.writeUInt8(tag, offset)
      offset += 1
    } else if (tag < 0x0eff) {
      buffer.writeUInt16BE(tag + 0xf000, offset)
      offset += 2
    } else {
      buffer.writeUInt8(0xff, offset++)
      let length = 0
      let tagValue = tag
      while (tagValue) {
        length++
        tagValue = tagValue >> 8
      }
      buffer.writeUInt8(length, offset++)

      tagValue = tag
      let lengthValue = length
      while (lengthValue--) {
        buffer.writeUInt8(tagValue & 0xff, offset + lengthValue)
        tagValue = tagValue >> 8
      }
      offset += length
    }
    return offset
  }

  const setLength = (buffer, offset, length) => {
    return setTag(buffer, offset, length)
  }

  const getValueData = (value, tag) => {
    let result = tagEntries.find(([field, info]) => info.tag === tag)
    if (result) {
      console.warn('toTLV found unsupport tag, ignore', tag, value)
      return
    }
    let type = result[1].type

    if (!value) {
      return Buffer.alloc(0)
    }

    let valueData
    if (type === 'complex') {
      valueData = toTLV(value)
    } else if (type === 'string') {
      valueData = new TextEncoder('utf8').encode(value)
    } else if (type === 'number') {
      let length = 0
      let valueValue = value
      while (valueValue) {
        length++
        valueValue = valueValue >> 8
      }
      valueData = Buffer.allocUnsafe(length)
      valueData.writeUIntBE(valueData, 0, length)
    } else {
      console.warn('toTLV found unsupport type', value, type)
      throw D.error.unknown
    }
    return valueData
  }

  const setValue = function (data, offset, valueData) {
    valueData.copy(data, offset)
  }

  const findTagInfoByField = (fieldName) => {
    let result = tagEntries.find(([field]) => field === fieldName)
    return result && result[1]
  }

  let data = Buffer.alloc(0)
  Object.entries(object).forEach(([field, value]) => {
    let tagInfo = findTagInfoByField(field)
    if (!tagInfo) {
      console.warn('toTLV found unsupport field, ignore', field, value)
      return
    }

    let tagLength = getVarLength(tagInfo.tag)
    let valueData = getValueData(value, tagInfo.tag)
    let length = valueData.length
    let lengthLength = getVarLength(length)

    let tlv = Buffer.allocUnsafe(tagLength + lengthLength + length)
    setTag(tlv, 0, tagInfo.tag)
    setLength(tlv, tagLength, valueData)
    setValue(valueData)

    data = Buffer.concat(data, tlv)
  })
  return data
}

export default class WalletData {
  constructor (transmitter) {
    this._fat = new Fat(new FatApi(transmitter))
  }

  async init () {
    await this._fat.init()
  }

  async getWalletInfo () {
    return parseTLV(await this._fat.readFile('cnw'))
  }

  setWalletInfo (walletInfo) {
    return this._fat.writeFile('cnw', toTLV(walletInfo))
  }

  async getAccountInfos () {
    let walletInfo = parseTLV(await this._fat.readFile('cnw'))
    let accountInfos = []
    for (let account of walletInfo.account) {
      if (!account.amount || !account.coinType) {
        console.warn('account data invalid', account, walletInfo)
        throw D.error.fatInvalidFile
      }
      accountInfos[account.coinType] = []
      for (let i = 0; i < account.amount; i++) {
        accountInfos[account.coinType].append(await this.getAccountInfo(account.coinType, i))
      }
    }

    return accountInfos
  }

  async getAccountInfo (coinType, index) {
    let accountName = 'cna#' + coinType + '#' + index
    return parseTLV(await this._fat.readFile(accountName))
  }

  setAccountInfo (accountInfo) {
    let accountName = 'cna#' + accountInfo.coinType + '#' + accountInfo.accountIndex
    return this._fat.writeFile(accountName, toTLV(accountInfo))
  }
}
