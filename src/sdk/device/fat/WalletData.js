import Fat from 'src/sdk/device/fat/Fat'
import FatApi from 'src/sdk/device/fat/FatApi'

/**
 * WalletData store data in files. Currently we have two types of files:
 * 1. wallet info, file name "cnw", only one file
 * 2. account info, file name "cna##coinType##index", number of files = number of accounts
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
 * 3. length is a flexible varible and its data of length in TLV:
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
 * coinwallet: {
 *   walletId: string,
 *   walletName: string
 *   account: {
 *    coinId: int,
 *    amount: int
 *   }
 *   account: {
 *    coinId: int,
 *    amount: int
 *   }
 *   ...
 * }
 *
 * coinaccount: {
 *   coinType, int
 *   accountIndex: int
 *   accountName: string
 *   accountExternalIndex: int
 *   accountChangeIndex: int
 *   txs: {
 *     txId: string,
 *     txComment: comment,
 *   }
 * }
 */

const tag = {
  walletId: 0x01,
  walletName: 0x02,

  accountIndex: 0x41,
  accountName: 0x42,
  accountExchangeIndex: 0x43,
  accountChangeIndeX: 0x44,
  txs: 0x45,

  txId: 0x81,
  txComment: 0x82
}

export default class WalletData {
  constructor (transmitter) {
    this._fat = new Fat(new FatApi(transmitter))
  }

  async init () {
    await this._fat.init()
  }

  /**
   * walletInfo: {
   * walletId: string
   * }
   */
  async getWalletInfo () {
  }

  setWalletInfo () {

  }

  getAccountInfos () {

  }

  /**
   *
   * @param accountIndex
   */
  getAccountInfo (accountIndex) {

  }

  setAccountInfo (accountIndex) {

  }
}