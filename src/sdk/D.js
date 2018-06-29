
import bitPony from 'bitpony'
import base58check from 'bs58check'
import createKeccakHash from 'keccak'

const D = {
  // wallet status
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
    deviceProtocol: 105,

    databaseOpenFailed: 201,
    databaseExecFailed: 202,

    lastAccountNoTransaction: 301,
    accountHasTransactions: 302,

    networkUnavailable: 401,
    networkNotInitialized: 402,
    networkProviderError: 403,

    balanceNotEnough: 501,
    txNotFound: 502,

    invalidAddress: 601,
    noAddressCheckSum: 602, // for eth
    invalidAddressChecksum: 603,
    notSupportP2SH: 604,

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
    change: 'change',

    checkBtcAddress (address) {
      let buffer
      try {
        buffer = base58check.decode(address)
      } catch (e) {
        console.warn(e)
        throw D.error.invalidAddress
      }
      if (buffer.length !== 21) throw D.error.invalidAddress

      let network = buffer.readUInt8(0)
      switch (network) {
        case 0: // main net P2PKH
          if (D.test.coin) throw D.error.invalidAddress
          break
        case 0x6f: // test net P2PKH
          if (!D.test.coin) throw D.error.invalidAddress
          break
        case 0x05: // main net P2SH
        case 0xc4: // test net P2SH
          throw D.error.notSupportP2SH
        default:
          throw D.error.invalidAddress
      }
      return true
    },

    checkEthAddress (address) {
      let checksum = D.address.toEthChecksumAddress(address)
      if (checksum === address) {
        return true
      }
      if (address.toUpperCase() === address || address.toLowerCase() === address) {
        throw D.error.noAddressCheckSum
      }
      throw D.error.invalidAddress
    },

    keccak256 (data) {
      if (data instanceof String) {
        if (data.startsWith('0x')) {
          data = data.slice(2)
        }
        data = D.toBuffer(data)
      }
      if (data instanceof ArrayBuffer) {
        data = Buffer.from(data)
      }
      return '0x' + createKeccakHash('keccak256').update(data).digest('hex')
    },

    /**
     * Copied from web3.utils.toChecksumAddress and modified.
     *
     * Converts to a checksum address
     *
     * @method toEthChecksumAddress
     * @param {String} address the given HEX address
     * @return {String}
     */
    toEthChecksumAddress (address) {
      if (address === undefined) return ''
      if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) throw D.error.invalidAddress

      address = address.toLowerCase().replace(/^0x/i, '')
      let addressHash = D.address.keccak256(address).replace(/^0x/i, '')
      let checksumAddress = '0x'
      for (let i = 0; i < address.length; i++) {
        // If ith character is 9 to f then make it uppercase
        if (parseInt(addressHash[i], 16) > 7) {
          checksumAddress += address[i].toUpperCase()
        } else {
          checksumAddress += address[i]
        }
      }
      return checksumAddress
    }
  },

  tx: {
    direction: {
      in: 'in',
      out: 'out'
    },
    matureConfirms: {
      btc: 6,
      eth: 6
    },

    getMatureConfirms (coinType) {
      if (D.isBtc(coinType)) {
        return D.tx.matureConfirms.btc
      } else if (D.isEth(coinType)) {
        return D.tx.matureConfirms.eth
      } else {
        throw D.error.coinNotSupported
      }
    }
  },

  utxo: {
    status: {
      unspent_pending: 'unspent_pending',
      unspent: 'unspent',
      spent_pending: 'spent_pending',
      spent: 'spent'
    }
  },

  fee: {
    fastest: 'fastest',
    fast: 'fast',
    normal: 'normal',
    economic: 'economic'
  },

  unit: {
    btc: {
      BTC: 'BTC',
      mBTC: 'mBTC',
      santoshi: 'santoshi'
    },
    eth: {
      ETH: 'ETH',
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

  isBtc (coinType) {
    return coinType.includes('btc')
  },

  isEth (coinType) {
    return coinType.includes('eth')
  },

  suppertedLegals () {
    return Object.values(this.unit.legal)
  },

  suppertedCoinTypes () {
    return Object.values(D.test.coin ? D.coin.test : D.coin.main)
  },

  recoverCoinTypes () {
    return D.suppertedCoinTypes()
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
        case D.unit.eth.ETH:
        case D.unit.eth.Ether: { wei = value * 1000000000000000000; break }
        case D.unit.eth.GWei: { wei = value * 1000000000; break }
        case D.unit.eth.Wei: { wei = value; break }
        default: throw D.error.unknown
      }
      switch (toType) {
        case D.unit.eth.ETH:
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

  dispatch (func) {
    setTimeout(func, 0)
  },

  toHex (array) {
    const hexChars = '0123456789ABCDEF'
    let hexString = new Array(array.byteLength * 2)
    let intArray = new Uint8Array(array)

    for (let i = 0; i < intArray.byteLength; i++) {
      hexString[2 * i] = hexChars.charAt((intArray[i] >> 4) & 0x0f)
      hexString[2 * i + 1] = hexChars.charAt(intArray[i] & 0x0f)
    }
    return hexString.join('')
  },

  toBuffer (hex) {
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
    coin: false,
    data: false,
    networkRequest: false,
    jsWallet: false,
    sync: false,
    mockDevice: false,
    // TODO remove when publish
    // sync used for test sync
    syncWalletId: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63',
    syncSeed: 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d38b80ca63',
    // sync used for test transaction
    txWalletId: '00000000805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000',
    txSeed: '00000000805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000',

    generateSeed () {
      let seed = ''
      const possible = '0123456789abcdef'
      for (let i = 0; i < 64; i++) seed += possible.charAt(Math.floor(Math.random() * possible.length))
      return seed
    }
  }
}
export default D
