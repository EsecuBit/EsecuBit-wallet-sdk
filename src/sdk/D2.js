
import bitPony from 'bitpony'

const D = {
  // listen status
  status: {
    plugIn: 1,
    initializing: 2,
    syncing: 3,
    syncFinish: 10,
    plugOut: 99
  },

  error: {
    succeed: 0,
    userCancel: 1,

    noDevice: 101,
    deviceComm: 102,
    deviceConnectFailed: 103,
    // TODO test
    deviceDeriveLargerThanN: 104,

    databaseOpenFailed: 201,
    databaseExecFailed: 202,

    lastAccountNoTransaction: 301,
    accountHasTransactions: 302,

    networkUnvailable: 401,
    networkNotInitialized: 402,
    networkProviderError: 403,

    txNotEnoughValue: 501,
    txNotFound: 502,

    notImplemented: 10000,
    unknown: 10001,
    coinNotSupported: 10002
  },

  coin: {
    main: {
      bitcoin: 'bitcoin',
      eth: 'ethernet'
    },
    test: {
      bitcoinTestnet3: 'bitcoin_testnet3',
      ethRopsten: 'ethernet_repsten'
    }
  },

  address: {
    external: 'external',
    change: 'change'
  },

  tx: {
    direction: {
      in: 'in',
      out: 'out'
    },
    matureConfirmations: {
      btc: 6,
      eth: 6
    }
  },

  utxo: {
    status: {
      unspent: 0,
      spent_pending: 1,
      spent: 2
    }
  },

  fee: {
    fast: 'fast',
    normal: 'normal',
    ecnomic: 'economy'
  },

  unit: {
    btc: {
      BTC: 'BTC',
      mBTC: 'mBTC',
      santoshi: 'santoshi'
    },
    eth: {
      eth: 'ether',
      gwei: 'gwei',
      wei: 'wei'
    },
    legal: {
      cny: 'CNY',
      usd: 'USD',
      eur: 'EUR',
      jpy: 'JPY'
    }
  },

  convertValue (coinType, value, fromType, toType) {
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
    let convertEth = (fee, fromType, toType) => {
      // TODO
    }
    switch (coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        return convertBtc(value, fromType, toType)
      case D.COIN_ETH:
      case D.COIN_ETH_TEST_ROPSTEN:
        return convertEth(value, fromType, toType)
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

  test: {
    mode: true,
    data: false,
    network_request: true,
    js_wallet: true,
    sync: false,
    // TODO remove when publish
    sync_wallet_id: 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b6c233b548',
    transaction_wallet_id: 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b600000000',
    sync_seed: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63',
    transaction_seed: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'
  }
}
export default D
