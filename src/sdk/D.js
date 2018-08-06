
import bitPony from 'bitpony'
import base58check from 'bs58check'
import createKeccakHash from 'keccak'
import {BigDecimal} from 'bigdecimal'
import bech32 from 'bech32'

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

    noDevice: 101,
    deviceComm: 102,
    deviceConnectFailed: 103,
    deviceDeriveLargerThanN: 104,
    deviceProtocol: 105,
    handShake: 106,
    needPressKey: 107, // sleep after long time idle
    userCancel: 108,
    pinError: 109,
    operationTimeout: 110,
    deviceNotInit: 111,

    databaseOpenFailed: 201,
    databaseExecFailed: 202,

    lastAccountNoTransaction: 301,
    accountHasTransactions: 302,

    networkUnavailable: 401,
    networkNotInitialized: 402,
    networkProviderError: 403,
    networkTxNotFound: 404,
    networkFeeTooSmall: 405,
    networkTooManyPendingTx: 406,
    networkValueTooSmall: 407,

    balanceNotEnough: 501,

    invalidAddress: 601,
    noAddressCheckSum: 602, // for eth
    invalidAddressChecksum: 603,
    valueIsDecimal: 604,

    notImplemented: 10000,
    unknown: 10001,
    coinNotSupported: 10002,

    checkSw1Sw2 (sw1sw2) {
      if (sw1sw2 === 0x9000) return D.error.succeed

      console.warn('sw1sw2 error', sw1sw2.toString(16))
      if (sw1sw2 === 0x6A81) return D.error.deviceNotInit
      if (sw1sw2 === 0x6FF8) return D.error.userCancel
      if (sw1sw2 === 0x6FF9) return D.error.operationTimeout
      if ((sw1sw2 & 0xFFF0) === 0x63C0) return D.error.pinError
      return D.error.deviceProtocol
    }
  },

  coin: {
    main: {
      btc: 'btc',
      eth: 'eth'
    },
    test: {
      btcTestNet3: 'btc_testnet3',
      ethRinkeby: 'eth_rinkeby',
      ethRopsten: 'eth_ropsten'
    }
  },

  address: {
    external: 'external',
    change: 'change',
    p2pkh: 'p2pkh',
    p2sh: 'p2sh',
    p2wpkh: 'p2wpkh',
    p2wsh: 'p2wsh',
    p2pk: 'p2pk',

    checkBtcAddress (address) {
      let buffer

      // segwit address, bech32 encoded
      let decodedBech32
      try {
        decodedBech32 = bech32.decode(address)
      } catch (e) {
        console.debug('address', address, 'is not bech32 encoded')
      }
      if (decodedBech32) {
        if (D.test.coin && decodedBech32.prefix !== 'tb') throw D.error.invalidAddress
        if (!D.test.coin && decodedBech32.prefix !== 'bc') throw D.error.invalidAddress
        buffer = bech32.fromWords(decodedBech32.words.slice(1))
        if (buffer.length === 20) return D.address.p2pkh
        if (buffer.length === 32) return D.address.p2wsh
        console.info('address', address, 'is bech32 encoded but has invalid length')
      }

      // normal address, base58 encoded
      try {
        buffer = base58check.decode(address)
      } catch (e) {
        console.warn(e)
        throw D.error.invalidAddress
      }
      // address
      if (buffer.length === 21) {
        let network = buffer.readUInt8(0)
        switch (network) {
          case 0: // main net P2PKH
            if (D.test.coin) throw D.error.invalidAddress
            return D.address.p2pkh
          case 0x05: // main net P2SH
            if (D.test.coin) throw D.error.invalidAddress
            return D.address.p2sh
          case 0x6f: // test net P2PKH
            if (!D.test.coin) throw D.error.invalidAddress
            return D.address.p2pkh
          case 0xc4: // test net P2SH
            if (!D.test.coin) throw D.error.invalidAddress
            return D.address.p2sh
          default:
            throw D.error.invalidAddress
        }
      }
      // publickey
      if (buffer.length === 78) {
        let versionBytes = buffer.readUInt32LE(0)
        switch (versionBytes) {
          case 0x0488B21E: // main net
            if (D.test.coin) throw D.error.invalidAddress
            return D.address.p2pk
          case 0x043587CF: // test net
            if (!D.test.coin) throw D.error.invalidAddress
            return D.address.p2pk
          default:
            throw D.error.invalidAddress
        }
      }
      throw D.error.invalidAddress
    },

    checkEthAddress (address) {
      let checksum = D.address.toEthChecksumAddress(address)
      if (checksum === address) {
        return true
      }
      if (address.startsWith('0x')) address = address.slice(2)
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
        data = Buffer.from(data, 'hex')
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
    },

    /**
     * convert string type address to Buffer
     */
    toBuffer (address) {
      // TODO throw Error instead of int in the whole project
      if (address.startsWith('0x')) {
        // eth
        return Buffer.from(address.slice(2), 'hex')
      } else {
        // bitcoin
        let buffer
        // p2wpkh & p2wsh address
        if (address.startsWith('bc') || address.startsWith('tb')) {
          let decodedBech32
          try {
            decodedBech32 = bech32.decode(address)
            buffer = bech32.fromWords(decodedBech32.words.slice(1))
            return buffer
          } catch (e) {
            console.debug('address', address, 'is not bech32 encoded')
            throw D.error.invalidAddress
          }
        }
        // p2pkh & p2sh address
        if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n') ||
          address.startsWith('2') || address.startsWith('3')) {
          try {
            buffer = base58check.decode(address)
          } catch (e) {
            console.warn(e)
            throw D.error.invalidAddress
          }
          if (buffer.length !== 21) throw D.error.invalidAddress
          return buffer.slice(1)
        }
        // p2pk address
        if (address.startsWith('xpub') || address.startsWith('tpub')) {
          try {
            buffer = base58check.decode(address)
          } catch (e) {
            console.warn(e)
            throw D.error.invalidAddress
          }
          if (buffer.length !== 78) throw D.error.invalidAddress
          return buffer.slice(45)
        }
      }
    },

    toString (address) {
      if (address.length === 20) {
        // eth
        return D.address.toEthChecksumAddress(address)
      } else if (address.length === 21) {
        // bitcoin
        return base58check.encode(Buffer.from(address))
      } else {
        throw D.error.coinNotSupported
      }
    },

    path: {
      /**
       * convert string type path to Buffer
       */
      toBuffer (path) {
        let level = path.split('/').length
        if (path[0] === 'm') level--
        let buffer = Buffer.allocUnsafe(level * 4)
        path.split('/').forEach((index, i) => {
          if (i === 0 && index === 'm') return
          let indexInt = 0
          if (index[index.length - 1] === "'") {
            indexInt += 0x80000000
            index = index.slice(0, -1)
          }
          indexInt += parseInt(index)
          buffer[4 * (i - 1)] = indexInt >> 24
          buffer[4 * (i - 1) + 1] = indexInt >> 16
          buffer[4 * (i - 1) + 2] = indexInt >> 8
          buffer[4 * (i - 1) + 3] = indexInt
        })
        return buffer
      }
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
      satoshi: 'satoshi'
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

  supportedCoinTypes () {
    return D.test.coin
      ? [D.coin.test.btcTestNet3, D.coin.test.ethRinkeby]
      : [D.coin.main.btc, D.coin.main.eth]
  },

  recoverCoinTypes () {
    return D.supportedCoinTypes()
  },

  convertValue (coinType, value, fromType, toType) {
    let mul = (a, b) => {
      a = new BigDecimal(a)
      b = new BigDecimal(b)
      let result = a.multiply(b).toPlainString()
      if (result.includes('.')) {
        let index = result.length - 1
        while (result[index] === '0') index--
        if (result[index] === '.') index--
        result = result.slice(0, index + 1)
      }
      return result
    }

    let convertBtc = (value, fromType, toType) => {
      value = value.toString()
      let satoshi
      switch (fromType) {
        case D.unit.btc.BTC: { satoshi = mul(value, '100000000'); break }
        case D.unit.btc.mBTC: { satoshi = mul(value, '100000'); break }
        case D.unit.btc.satoshi: { satoshi = value; break }
        default:
          console.warn('convertBtc fromType unit incorrect', fromType)
          throw D.error.unknown
      }
      switch (toType) {
        case D.unit.btc.BTC: return mul(satoshi, '0.00000001')
        case D.unit.btc.mBTC: return mul(satoshi, '0.00001')
        case D.unit.btc.satoshi: return satoshi
      }
      return 0
    }
    let convertEth = (value, fromType, toType) => {
      value = value.toString()
      let wei
      switch (fromType) {
        case D.unit.eth.ETH:
        case D.unit.eth.Ether: { wei = mul(value, '1000000000000000000'); break }
        case D.unit.eth.GWei: { wei = mul(value, '1000000000'); break }
        case D.unit.eth.Wei: { wei = value; break }
        default:
          console.warn('convertEth fromType unit incorrect', fromType)
          throw D.error.unknown
      }
      switch (toType) {
        case D.unit.eth.ETH:
        case D.unit.eth.Ether: return mul(wei, '0.000000000000000001')
        case D.unit.eth.GWei: return mul(wei, '0.000000001')
        case D.unit.eth.Wei: return wei
      }
      return '0'
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

  getRandomHex (length) {
    let hex = ''
    const possible = '0123456789abcdef'
    for (let i = 0; i < length; i++) hex += possible.charAt(Math.floor(Math.random() * possible.length))
    return hex
  },

  isDecimal (num) {
    return num.toString().includes('.')
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
      return D.getRandomHex(64)
    }
  }
}
export default D
