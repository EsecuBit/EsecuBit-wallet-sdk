
import bitPony from 'bitpony'

const D = {
  // listen status
  STATUS_PLUG_IN: 1,
  STATUS_INITIALIZING: 2,
  STATUS_SYNCING: 3,
  STATUS_SYNC_FINISH: 10,
  STATUS_PLUG_OUT: 99,

  // error code
  ERROR_NO_ERROR: 0,
  ERROR_USER_CANCEL: 1,

  ERROR_NO_DEVICE: 101,
  ERROR_DEVICE_COMM: 102,
  ERROR_DEVICE_CONNECT_FAILED: 103,
  ERROR_DEVICE_DERIVE_LARGER_THAN_N: 104,

  ERROR_DATABASE_OPEN_FAILED: 201,
  ERROR_DATABASE_EXEC_FAILED: 202,

  ERROR_LAST_ACCOUNT_NO_TRANSACTION: 301,
  ERROR_ACCOUNT_HAS_TRANSACTIONS: 302,

  ERROR_NETWORK_UNVAILABLE: 401,
  ERROR_NETWORK_NOT_INITIALIZED: 402,
  ERROR_NETWORK_PROVIDER_ERROR: 403,

  ERROR_TX_NOT_ENOUGH_VALUE: 501,
  ERROR_TX_NOT_FOUND: 502,

  ERROR_NOT_IMPLEMENTED: 10000,
  ERROR_UNKNOWN: 10001,
  ERROR_COIN_NOT_SUPPORTED: 10002,

  // coin type
  COIN_BIT_COIN: 'bitcoin',
  COIN_BIT_COIN_TEST: 'bitcoin_test',
  COIN_ETH: 'ethernet',
  COIN_ETH_TEST: 'ethernet_test',

  // BIP44
  ADDRESS_EXTERNAL: 'external',
  ADDRESS_CHANGE: 'change',

  // transaction
  TX_DIRECTION_IN: 'in',
  TX_DIRECTION_OUT: 'out',
  TX_BTC_MATURE_CONFIRMATIONS: 6,
  UTXO_UNSPENT: 0,
  UTXO_SPENT_PENDING: 1,
  UTXO_SPENT: 2,

  // fee type
  FEE_FAST: 'fast',
  FEE_NORMAL: 'normal',
  FEE_ECNOMIC: 'economy',

  // value type
  UNIT_BTC: 'btc',
  UNIT_BTC_M: 'mbtc',
  UNIT_BTC_SANTOSHI: 'santoshi',

  convertValue (coinType, fee, fromType, toType) {
    let convertBtc = (fee, fromType, toType) => {
      let santoshi
      switch (fromType) {
        case D.UNIT_BTC: { santoshi = fee * 100000000; break }
        case D.UNIT_BTC_M: { santoshi = fee * 100000; break }
        case D.UNIT_BTC_SANTOSHI: { santoshi = fee; break }
        default: throw D.ERROR_UNKNOWN
      }
      switch (toType) {
        case D.UNIT_BTC: return Number(santoshi / 100000000)
        case D.UNIT_BTC_M: return Number(santoshi / 100000)
        case D.UNIT_BTC_SANTOSHI: return Number(santoshi)
      }
    }
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return convertBtc(fee, fromType, toType)
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  },

  wait (timeMill) {
    return new Promise(resolve => setTimeout(resolve, timeMill))
  },

  arrayBufferToHex (array) {
    const hexChars = '0123456789ABCDEF'
    let hexString = new Array(array.byteLength * 2)
    let intArray = new Uint8Array(array)

    for (let i = 0; i < intArray.byteLength; i++) {
      hexString[2 * i] = hexChars.charAt((intArray[i] >> 4) & 0x0f)
      hexString[2 * i + 1] = hexChars.charAt(intArray[i] & 0x0f)
    }
    return hexString.join('')
  },

  hexToArrayBuffer (hex) {
    const hexChars = '0123456789ABCDEFabcdef'
    let result = new ArrayBuffer(hex.length / 2)
    let res = new Uint8Array(result)
    for (let i = 0; i < hex.length; i += 2) {
      if (hexChars.indexOf(hex.substring(i, i + 1)) === -1) break
      res[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return result
  },

  getCoinIndex (coinType) {
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return 0
      case D.COIN_ETH:
      case D.COIN_ETH_TEST:
        return 60
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  },

  makeBip44Path (coinType, accountIndex, type, addressIndex) {
    return "m/44'/" +
      D.getCoinIndex(coinType) + "'/" +
      accountIndex + "'/" +
      (type === D.ADDRESS_EXTERNAL ? 0 : 1) +
      (addressIndex === undefined ? '' : ('/' + addressIndex))
  },

  /**
   * @return format tx
   * {
   *   hash: hex string,
   *   length: int,
   *   in_count: int.
   *   in: [{hash, index, scriptSig, script_len, sequence}, ...]
   *   out_count: int,
   *   out: [{amount, scriptPubKey, script_len}, ...]
   *   lock_time: long
   * }
   */
  parseRawTx (hexTx) {
    return bitPony.tx.read(hexTx)
  },

  /**
   * shallow copy
   * @param object
   */
  copy (object) {
    return JSON.parse(JSON.stringify(object))
  },

  // test
  TEST_MODE: true,
  TEST_DATA: false,
  TEST_NETWORK_REQUEST: true,
  TEST_JS_WALLET: true,
  TEST_SYNC: false,
  // TODO remove when publish
  TEST_SYNC_WALLET_ID: 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548',
  TEST_TRANSACTION_WALLET_ID: 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B600000000',
  TEST_SYNC_SEED: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63',
  TEST_TRANSACTION_SEED: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'
}
export default D
