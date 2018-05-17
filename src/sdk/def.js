
const D = {
  TEST_MODE: true,

  ERROR_USER_CANCEL: 1,

  ERROR_NO_DEVICE: 101,
  ERROR_DEVICE_COMM: 102,
  ERROR_DEVICE_CONNECT_FAILED: 103,

  ERROR_DATABASE_OPEN_FAILED: 201,
  ERROR_DATABASE_EXEC_FAILED: 202,

  ERROR_LAST_ACCOUNT_NO_TRANSACTION: 301,

  ERROR_NETWORK_UNVAILABLE: 401,
  ERROR_NETWORK_NOT_INITIALIZED: 402,
  ERROR_NETWORK_PROVIDER_ERROR: 403,

  ERROR_NOT_IMPLEMENTED: 10000,
  ERROR_UNKNOWN: 10001,
  ERROR_COIN_NOT_SUPPORTED: 10002,

  COIN_BIT_COIN: 'bitcoin',
  COIN_BIT_COIN_TEST: 'bitcoin_test',

  // BIP44
  ADDRESS_EXTERNAL: 0,
  ADDRESS_CHANGE: 1,

  TRANSACTION_DIRECTION_IN: 'in',
  TRANSACTION_DIRECTION_OUT: 'out',
  TRANSACTION_BTC_MATURE_CONFIRMATIONS: 6,

  FEE_FAST: 'fast',
  FEE_NORMAL: 'normal',
  FEE_ECNOMIC: 'economy',

  getFloatFee: function (coinType, fee) {
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return Number(fee / 100000000)
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
  },

  wait: (timeMill) => {
    return new Promise(resolve => setTimeout(resolve, timeMill))
  }
}
module.exports = {class: D}
