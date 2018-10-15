import Fat from './Fat'
import FatApi from './FatApi'
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
 *   walletDataVersion: number, // sync data version, > 0
 *   walletDataStamp: number, // sync mill time stamp, > 0
 *   account: {
 *    coinType: string,
 *    amount: number
 *   },
 *   account: {
 *    coinType: string,
 *    amount: number
 *   }
 *   ...
 * }
 *
 * cna_btc_1: {
 *   coinType: string
 *   accountIndex: number
 *   accountName: string
 *   accountExternalIndex: number
 *   accountChangeIndex: number
 *   txInfo: {
 *     txId: data,
 *     txComment: comment,
 *   },
 *   txInfo: {
 *     txId: data,
 *     txComment: comment,
 *   },
 *   ...
 * }
 */

const tags = {
  coinWallet: {tag: 0x01, type: 'complex'}, // currently not used, we judge data type by file name instead of tag
  walletId: {tag: 0x03, type: 'string'},
  walletName: {tag: 0x04, type: 'string'},
  walletDataVersion: {tag: 0x05, type: 'number'},
  walletDataStamp: {tag: 0x06, type: 'number'},
  account: {tag: 0x11, type: ['array', 'complex']},
  coinType: {tag: 0x12, type: 'string'},
  amount: {tag: 0x013, type: 'number'},

  coinAccount: {tag: 0x41, type: 'complex'}, // currently not used, we judge data type by file name instead of tag
  accountIndex: {tag: 0x42, type: 'number'},
  accountName: {tag: 0x43, type: 'string'},
  accountExternalIndex: {tag: 0x44, type: 'number'},
  accountChangeIndex: {tag: 0x45, type: 'number'},
  txInfo: {tag: 0x51, type: ['array', 'complex']},
  txId: {tag: 0x52, type: 'data'},
  txComment: {tag: 0x53, type: 'string'}
}
const tagEntries = Object.entries(tags)

const parseTLV = (data) => {
  const setFieldByTag = function (object, tag, value) {
    let result = tagEntries.find(([field, info]) => info.tag === tag)
    if (!result) {
      console.warn('parseTLV found unsupport tag, ignore', tag, value.toString('hex'))
      return
    }
    let field = result[0]
    let type = result[1].type
    if (!Array.isArray(type)) type = [type]

    let actualValue
    if (type.includes('complex')) {
      actualValue = parseTLV(value)
    } else if (type.includes('string')) {
      actualValue = new TextDecoder('utf8').decode(value)
    } else if (type.includes('number')) {
      actualValue = value.readIntBE(0, value.length)
    } else if (type.includes('data')) {
      actualValue = Buffer.from(value)
    } else {
      console.warn('parseTLV found unsupport type', field, type)
      throw D.error.unknown
    }

    if (type.includes('array')) {
      if (!object[field]) {
        object[field] = []
      }
      object[field].push(actualValue)
    } else {
      object[field] = actualValue
    }
  }

  try {
    let object = {}
    let offset = 0
    while (true) {
      let firstByte = data[offset++]
      let tag

      if (firstByte === undefined) {
        console.debug('parseTLV end', object)
        return object
      } else if (firstByte === 0) {
        console.warn('parseTLV get tag == 0, it is end of the TLV structure. data size != tlv size, it is ok, exist')
        return object
      }

      if (firstByte < 0xf0) {
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

      let value = data.slice(offset, offset + length)
      setFieldByTag(object, tag, value)
      offset += length
    }
  } catch (e) {
    console.warn('parseTLV failed', data.toString('hex'), e)
    throw D.error.fatInvalidFileData
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
        value = Math.floor(value / 256)
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
        tagValue = Math.floor(tagValue / 256)
      }
      buffer.writeUInt8(length, offset++)

      tagValue = tag
      let lengthValue = length
      while (lengthValue--) {
        buffer.writeUInt8(tagValue & 0xff, offset + lengthValue)
        tagValue = Math.floor(tagValue / 256)
      }
      offset += length
    }
    return offset
  }

  const setLength = (buffer, offset, length) => {
    return setTag(buffer, offset, length)
  }

  const getValueData = (value, field, tagInfo) => {
    let type = tagInfo.type

    let valueData
    if (type.includes('complex')) {
      valueData = toTLV(value)
    } else if (type.includes('string')) {
      valueData = Buffer.from(new TextEncoder('utf8').encode(value))
    } else if (type.includes('number')) {
      let length = 0
      let tempValue = value
      do {
        tempValue = Math.floor(tempValue / 256)
        length++
      } while (tempValue)
      valueData = Buffer.allocUnsafe(length)
      valueData.writeUIntBE(value, 0, length)
    } else if (type.includes('data')) {
      valueData = Buffer.from(value)
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

  console.debug('toTLV', object)
  let data = Buffer.alloc(0)
  Object.entries(object).forEach(([field, value]) => {
    console.debug('toTLV field', field, value)

    let tagInfo = findTagInfoByField(field)
    if (!tagInfo) {
      console.warn('toTLV found unsupport field', field, value)
      throw D.error.unknown
    }

    const buildTLV = (value, tagInfo) => {
      let tagLength = getVarLength(tagInfo.tag)
      let valueData = getValueData(value, field, tagInfo)
      let length = valueData.length
      let lengthLength = getVarLength(length)

      let tlv = Buffer.allocUnsafe(tagLength + lengthLength + length)
      setTag(tlv, 0, tagInfo.tag)
      setLength(tlv, tagLength, length)
      setValue(tlv, tagLength + lengthLength, valueData)

      return tlv
    }

    let type = tagInfo.type
    if (type.includes('array')) {
      for (let item of value) {
        data = Buffer.concat([data, buildTLV(item, tagInfo)])
      }
    } else {
      data = Buffer.concat([data, buildTLV(value, tagInfo)])
    }
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

  /**
   * Get wallet data from device, then merge and sync. We have following situations to handle:
   * (app.walletDataVersion should always >= lastSyncVersion)
   *
   * 1. If app.walletDataVersion > lastSyncVersion.
   * In this case, update app's data to device's data.
   *
   * 2. device.walletDataVersion == lastSyncVersion and app.walletDataVersion === lastSyncVersion, nothing to do.
   *
   * 3. If device.walletDataVersion < lastSyncVersion, which means the key's data was reset of broken.
   * In this case, update app's data to device's data.
   *
   * 4. If device.walletDataVersion > lastSyncVersion, that means device's data was updated somewhere else.
   * In this case, update app's data from device's data.
   *
   * 5. If 1 and 4 both occured, we need to merge both data. and if some fields of the data is confilcted, we choose
   * the later one. Later one: compare device.walletDataStamp with app.walletDataStamp
   *
   * @param walletInfo generated by app with lastest local data
   * @param accountInfos accountInfos generated by app with lastest local data
   * @param lastSyncVersion walletDataVersion at last sync
   * @return Primise<> {
   *    needUpdate: whether the app's data needs update
   *    walletInfo: new walletInfo,
   *    accountInfos: new accountInfos
   * }
   */
  async sync (walletInfo, accountInfos, lastSyncVersion) {
    if (!lastSyncVersion) {
      console.log('wallet data first time sync')
      lastSyncVersion = 0
    }

    let app = walletInfo
    console.info('sync wallet data app', app)

    let device = await this.getWalletInfo()
    console.info('sync wallet data device', device)

    if (device && app.walletId !== device.walletId) {
      console.warn('wallet id not match, stopped', app.walletId, device.walletId)
      throw D.error.fatWalletIdNotMatch
    }

    if (!device) {
      console.info('wallet info not found, set walletDataVersion = -1')
      device = {walletDataVersion: -1}
    }

    if (app.walletDataVersion < lastSyncVersion) {
      console.warn('appData.version < lastSyncVersion, it may due to software bug, make appData.version = lastSyncVersion')
      app.walletDataVersion = lastSyncVersion
    }

    let updateFlag = 0
    if (app.walletDataVersion > lastSyncVersion) {
      console.info('app.version > lastSyncVersion, need update to device')
      updateFlag |= 0x01
    }

    if (device.walletDataVersion === lastSyncVersion) {
      if (app.walletDataVersion === lastSyncVersion) {
        console.info('wallet data no change, nothing to do')
        return {needUpdate: false}
      }
    } else if (device.walletDataVersion < lastSyncVersion) {
      console.warn('device.version < lastSyncVersion, device\'s data may reset of broken, need update to device')
      updateFlag |= 0x01
    } else {
      console.info('device.version > app.version, need update from device')
      updateFlag |= 0x02
    }

    let deviceAccountInfos
    switch (updateFlag) {
      case 0x01:
        console.info('app modified the wallet data, update to device')
        await this.setAccountInfos(accountInfos)
        await this.setWalletInfo(app)
        return {needUpdate: false}

      case 0x02:
        console.info('device modified the wallet data, update from device')
        deviceAccountInfos = await this.getAccountInfos(device)
        return {
          needUpdate: true,
          walletInfo: device,
          accountInfos: deviceAccountInfos
        }

      case 0x03:
        console.warn('app and device both modified the wallet data, need merge')
        let newerWalletInfo = D.copy(app.walletDataStamp >= device.walletDataStamp ? app : device)
        let olderWalletInfo = D.copy(app.walletDataStamp >= device.walletDataStamp ? device : app)
        newerWalletInfo.walletDataVersion = Math.max(app.walletDataVersion, device.walletDataVersion) + 1

        for (let account of olderWalletInfo.account) {
          let newerAccount = newerWalletInfo.account.find(a => a.coinType === account.coinType)
          if (!newerAccount) {
            newerWalletInfo.account.push(account)
          } else {
            newerAccount.amount = Math.max(newerAccount.amount, account.amount)
          }
        }

        deviceAccountInfos = await this.getAccountInfos(device)
        let newerAccountInfos = D.copy(app.walletDataStamp >= device.walletDataStamp ? accountInfos : deviceAccountInfos)
        let olderAccountInfos = D.copy(app.walletDataStamp >= device.walletDataStamp ? deviceAccountInfos : accountInfos)

        let updatedAccounts = []
        for (let accountInfo of olderAccountInfos) {
          let newerAccountInfo = newerAccountInfos.find(a =>
            a.coinType === accountInfo.coinType && a.accountIndex === accountInfo.accountIndex)
          if (!newerAccountInfo) {
            newerAccountInfos.push(accountInfo)
            updatedAccounts.push(accountInfo)
          } else {
            for (let txInfo of accountInfo.txInfo) {
              let newerTxInfo = newerAccountInfo.txInfo.find(t => t.txId === txInfo.txId)
              if (!newerTxInfo) {
                newerAccountInfo.txInfo.push(txInfo)
                if (!updatedAccounts.includes(newerAccountInfo)) {
                  updatedAccounts.push(newerAccountInfo)
                }
              }
            }
          }
        }

        for (let accountInfo of newerAccountInfos) {
          let newerAccountInfo = olderAccountInfos.find(a =>
            a.coinType === accountInfo.coinType && a.accountIndex === accountInfo.accountIndex)
          if (!newerAccountInfo) {
            updatedAccounts.push(accountInfo)
          }
        }

        console.info('wallet data sync updatedAccounts', updatedAccounts)
        await this.setAccountInfos(updatedAccounts)
        await this.setWalletInfo(newerWalletInfo)
        return {
          needUpdate: true,
          walletInfo: newerWalletInfo,
          accountInfos: newerAccountInfos
        }

      default:
        console.warn('wallet data sync: unknown flag', updateFlag)
        throw D.error.unknown
    }
  }

  async getWalletInfo () {
    try {
      let fileData = await this._fat.readFile('cnw')
      let walletInfo = WalletData._parseTLV(fileData)

      walletInfo.account = walletInfo.account || []
      console.debug('getWalletInfo', walletInfo)
      return walletInfo
    } catch (e) {
      if (e === D.error.fatFileNotExists) {
        return null
      }
      throw e
    }
  }

  setWalletInfo (walletInfo) {
    console.debug('setWalletInfo', walletInfo)
    return this._fat.writeFile('cnw', WalletData._toTLV(walletInfo))
  }

  async getAccountInfos (walletInfo) {
    walletInfo = walletInfo || WalletData._parseTLV(await this._fat.readFile('cnw'))
    let accountInfos = []
    for (let account of walletInfo.account) {
      if (!account.amount || !account.coinType) {
        console.warn('account data invalid', account, walletInfo)
        throw D.error.fatInvalidFileData
      }
      for (let i = 0; i < account.amount; i++) {
        accountInfos.push(await this.getAccountInfo(account.coinType, i))
      }
    }

    return accountInfos
  }

  async setAccountInfos (accountInfos) {
    for (let accountInfo of accountInfos) {
      await this.setAccountInfo(accountInfo)
    }
  }

  async getAccountInfo (coinType, index) {
    let accountName = 'cna_' + coinType + '_' + index
    let fileData = await this._fat.readFile(accountName)
    let accountInfo = WalletData._parseTLV(fileData)

    accountInfo.txInfo = accountInfo.txInfo || []
    console.debug('getAccountInfo', accountInfo)
    return accountInfo
  }

  setAccountInfo (accountInfo) {
    console.debug('setAccountInfo', accountInfo)
    let accountName = 'cna_' + accountInfo.coinType + '_' + accountInfo.accountIndex
    return this._fat.writeFile(accountName, WalletData._toTLV(accountInfo))
  }

  static _parseTLV (data) {
    return parseTLV(data)
  }

  static _toTLV (object) {
    return toTLV(object)
  }
}
