
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
    deviceDeriveLargerThanN: 104,

    databaseOpenFailed: 201,
    databaseExecFailed: 202,

    lastAccountNoTransaction: 301,
    accountHasTransactions: 302,

    networkUnavailable: 401,
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
      btc: 'btc',
      eth: 'eth'
    },
    test: {
      btcTestNet3: 'btc_testnet3',
      ethRinkeby: 'eth_rinkeby'
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
    matureConfirms: {
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
    fastest: 'fastest',
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
      Ether: 'Ether',
      GWei: 'GWei',
      Wei: 'Wei'
    },
    legal: {
      USD: 'USD',
      EUR: 'EUR',
      CNY: 'CNY',
      JPY: 'JPY'
    }
  },

  suppertedLegals () {
    return Object.values(this.unit.legal)
  },

  suppertedCoinTypes () {
    return Object.values(D.test.mode ? D.coin.test : D.coin.main)
  },

  // TODO let user select
  recoverCoinTypes () {
    return [D.coin.test.btcTestNet3, D.coin.test.ethRinkeby]
  },

  convertValue (coinType, value, fromType, toType) {
    let convertBtc = (value, fromType, toType) => {
      let santoshi
      switch (fromType) {
        case D.unit.btc.BTC: { santoshi = value * 100000000; break }
        case D.unit.btc.mBTC: { santoshi = value * 100000; break }
        case D.unit.btc.santoshi: { santoshi = value; break }
        default: throw D.error.unknown
      }
      switch (toType) {
        case D.unit.btc.BTC: return Number(santoshi / 100000000)
        case D.unit.btc.mBTC: return Number(santoshi / 100000)
        case D.unit.btc.santoshi: return Number(santoshi)
      }
    }
    let convertEth = (value, fromType, toType) => {
      let wei
      switch (fromType) {
        case D.unit.eth.Ether: { wei = value * 1000000000000000000; break }
        case D.unit.eth.GWei: { wei = value * 1000000000; break }
        case D.unit.eth.Wei: { wei = value; break }
        default: throw D.error.unknown
      }
      switch (toType) {
        case D.unit.eth.Ether: return Number(wei / 1000000000000000000)
        case D.unit.eth.GWei: return Number(wei / 1000000000)
        case D.unit.eth.Wei: return Number(wei)
      }
    }
    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return convertBtc(value, fromType, toType)
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        return convertEth(value, fromType, toType)
      default:
        throw D.error.coinNotSupported
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
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return 0
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        return 60
      default:
        throw D.error.coinNotSupported
    }
  },

  makeBip44Path (coinType, accountIndex, type, addressIndex) {
    return "m/44'/" +
      D.getCoinIndex(coinType) + "'/" +
      accountIndex + "'/" +
      (type === D.address.external ? 0 : 1) +
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
  parseBitcoinRawTx (hexTx) {
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
    networkRequest: true,
    jsWallet: true,
    sync: false,
    // TODO remove when publish
    // sync used for test sync
    syncWalletId: 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b6c233b548',
    syncSeed: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63',
    // sync used for test transaction
    txWalletId: 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b600000000',
    txSeed: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'
  }
}
export default D
