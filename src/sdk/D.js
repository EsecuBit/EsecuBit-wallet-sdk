
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

  ERROR_NETWORK_UNVAILABLE: 401,
  ERROR_NETWORK_NOT_INITIALIZED: 402,
  ERROR_NETWORK_PROVIDER_ERROR: 403,

  ERROR_TX_NOT_ENOUGH_VALUE: 501,

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

  // fee type
  FEE_FAST: 'fast',
  FEE_NORMAL: 'normal',
  FEE_ECNOMIC: 'economy',

  getFloatFee (coinType, intFee) {
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return Number(intFee / 100000000)
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  },

  getIntFee (coinType, floatFee) {
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return Number(floatFee * 100000000)
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

  // test
  TEST_MODE: true,
  TEST_DATA: false,
  TEST_NETWORK_REQUEST: false,
  TEST_JS_WALLET: true,
  TEST_SYNC: false,
  TEST_WALLET_ID: 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548'
}
export default D
