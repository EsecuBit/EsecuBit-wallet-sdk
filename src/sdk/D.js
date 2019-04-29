
import bitPony from 'bitpony'
import base58check from 'bs58check'
import bitcoin from 'bitcoinjs-lib'
import createKeccakHash from 'keccak'
import {BigDecimal} from 'bigdecimal'
import bech32 from 'bech32'
import createHash from 'create-hash'
import base58 from 'bs58'
import {Buffer} from 'buffer'

const D = {
  sdkVersion: require('../../package.json').version,

  // wallet status
  status: {
    plugIn: 1,
    initializing: 2,
    deviceChange: 3,
    auth: 4,
    authFinish: 5,
    syncing: 10,
    syncingNewAccount: 11,
    syncFinish: 20,
    plugOut: 99,
    newEosPermissions: 1001,
    confirmedEosPermission: 1002,
    canceledEosPermission: 1003
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
    devicePressKeyTooEarly: 112,
    deviceApduDataInvalid: 113,
    deviceNotConnected: 114,
    deviceNeedReauthenticate: 115,
    deviceConditionNotSatisfied: 116,

    fatUnavailable: 121,
    fatOutOfRange: 122,
    fatInvalidFile: 123,
    fatOutOfSpace: 124,
    fatFileNotExists: 125,
    fatInvalidFileData: 126,
    fatWalletIdNotMatch: 127,

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
    networkGasTooLow: 408,
    networkGasPriceTooLow: 409,

    networkEosTokenNotFound: 450,
    networkEosTxExpired: 451,
    networkEosUnsatisfiedAuth: 452,

    balanceNotEnough: 501,
    tooManyOutputs: 502,

    invalidAddress: 601,
    noAddressCheckSum: 602, // for eth
    invalidAddressChecksum: 603,
    valueIsDecimal: 604, // value has decimal
    invalidDataNotHex: 605, // data is not 0-9 a-f A-F string
    valueIsNotDecimal: 606, // value is not 0-9 string
    invalidParams: 607,
    permissionNotFound: 608, // for eos
    permissionNoNeedToConfirmed: 609, // for eos
    multipleAccounts: 611, // for eos
    keyNotMatch: 612, // for eos

    offlineModeNotAllowed: 701, // no device ever connected before
    offlineModeUnnecessary: 702, // device has connected

    notImplemented: 10000,
    unknown: 10001,
    coinNotSupported: 10002,

    checkSw1Sw2 (sw1sw2) {
      if (sw1sw2 === 0x9000) return D.error.succeed

      console.warn('sw1sw2 error', sw1sw2 && sw1sw2.toString(16))
      sw1sw2 = sw1sw2 & 0xFFFF
      if (sw1sw2 === 0x6A80) return D.error.deviceApduDataInvalid
      if (sw1sw2 === 0x6A81) return D.error.deviceNotInit
      if (sw1sw2 === 0x6FF8) return D.error.userCancel
      if (sw1sw2 === 0x6FF9) return D.error.operationTimeout
      if (sw1sw2 === 0x6FFE) return D.error.devicePressKeyTooEarly
      if (sw1sw2 === 0x6A83) return D.error.deviceNeedReauthenticate
      if (sw1sw2 === 0x6985) return D.error.deviceConditionNotSatisfied
      if ((sw1sw2 & 0xFFF0) === 0x63C0) return D.error.pinError
      return D.error.deviceProtocol
    }
  },

  coin: {
    main: {
      btc: 'btc_main',
      eth: 'eth_main',
      eos: 'eos_main'
    },
    test: {
      btcTestNet3: 'btc_testnet3',
      ethRinkeby: 'eth_rinkeby',
      ethRopsten: 'eth_ropsten',
      eosJungle: 'eos_jungle',
      eosKylin: 'eos_kylin',
      eosSys: 'eos_sys'
    },
    other: {
      hdwallet: 'hdwallet',
      manager: 'manager',
      backup: 'hdwallet'
    },

    params: {
      btc: {
        getNetwork (coinType) {
          switch (coinType) {
            case D.coin.main.btc:
              return bitcoin.networks.bitcoin
            case D.coin.test.btcTestNet3:
              return bitcoin.networks.testnet
          }
        }
      },

      eth: {
        getChainId (coinType) {
          switch (coinType) {
            case D.coin.main.eth:
              return 1
            case D.coin.test.ethRopsten:
              return 3
            case D.coin.test.ethRinkeby:
              return 4
            default:
              console.warn('eth don\'t support this coinType for chainId', coinType)
              throw D.error.coinNotSupported
          }
        }
      },

      eos: {
        chainId: {
          main: Buffer.from('aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', 'hex'), // main network
          jungle: Buffer.from('e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473', 'hex'), // jungle testnet
          sys: Buffer.from('cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f', 'hex'), // local developer
          kylin: Buffer.from('5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191', 'hex') // kylin testnet
        },

        getChainId (coinType) {
          switch (coinType) {
            case D.coin.main.eos:
              return D.coin.params.eos.chainId.main
            case D.coin.test.eosJungle:
              return D.coin.params.eos.chainId.jungle
            case D.coin.test.eosKylin:
              return D.coin.params.eos.chainId.kylin
            case D.coin.test.eosSys:
              return D.coin.params.eos.chainId.sys
            default:
              console.warn('eos don\'t support this coinType for chainId', coinType)
              throw D.error.coinNotSupported
          }
        },

        defaultActionType: {type: 'other'},

        actionTypes: {
          transfer: {
            type: 'tokenTransfer',
            name: 'transfer',
            data: {
              from: 'name',
              to: 'name',
              quantity: 'asset',
              memo: 'string'
            }
          },
          issuer: {
            type: 'tokenIssuer',
            name: 'issuer',
            data: {
              from: 'name',
              to: 'name',
              quantity: 'asset',
              memo: 'string'
            }
          },
          delegate: {
            type: 'eosioDelegatebw',
            account: 'eosio',
            name: 'delegatebw',
            data: {
              from: 'name',
              receiver: 'name',
              stake_net_quantity: 'asset',
              stake_cpu_quantity: 'asset',
              transfer: 'uint8'
            }
          },
          undelegate: {
            type: 'eosioUndelegatebw',
            account: 'eosio',
            name: 'undelegatebw',
            data: {
              from: 'name',
              receiver: 'name',
              unstake_net_quantity: 'asset',
              unstake_cpu_quantity: 'asset'
            }
          },
          buyram: {
            type: 'eosioBuyRam',
            account: 'eosio',
            name: 'buyram',
            data: {
              payer: 'name',
              receiver: 'name',
              quant: 'asset'
            }
          },
          buyrambytes: {
            type: 'eosioBuyRamBytes',
            account: 'eosio',
            name: 'buyrambytes',
            data: {
              payer: 'name',
              receiver: 'name',
              bytes: 'uint32'
            }
          },
          sellram: {
            type: 'eosioSellRam',
            account: 'eosio',
            name: 'sellram',
            data: {
              account: 'name',
              bytes: 'uint64'
            }
          },
          vote: {
            type: 'eosioVoteProducer',
            account: 'eosio',
            name: 'voteproducer',
            data: {
              voter: 'name',
              proxy: 'name',
              producers: 'name[]'
            }
          },
          other: {
            type: 'other'
          }
        },

        getActionType (account, name) {
          let actionType = Object.values(D.coin.params.eos.actionTypes).find(type =>
            type.name === name && (!type.account || type.account === account))
          return actionType || D.coin.params.eos.defaultActionType
        }
      }
    }
  },

  account: {
    status: {
      show: 0,
      hideByNoTxs: 1,
      hideByUser: 2
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

    checkAddress (coinType, address) {
      if (D.isBtc(coinType)) {
        return D.address.checkBtcAddress(coinType, address)
      } else if (D.isEth(coinType)) {
        return D.address.checkEthAddress(address)
      } else if (D.isEos(coinType)) {
        return D.address.checkEosAddress(address)
      } else {
        console.warn('checkAddress don\'t this coinType', coinType, address)
        throw D.error.coinNotSupported
      }
    },

    checkEosAddress (name) {
      // check whether account name is valid, copy from eos.js
      const charmap = '.12345abcdefghijklmnopqrstuvwxyz'
      const charidx = function charidx (ch) {
        const idx = charmap.indexOf(ch)
        if (idx === -1) throw new TypeError('Invalid character: \'' + ch + '\'')
        return idx
      }
      if (typeof name !== 'string') {
        console.warn('checkEosAddress name parameter is a required string')
        throw D.error.invalidAddress
      }
      if (name.length > 12) {
        console.warn('checkEosAddress A name can be up to 12 characters long')
        throw D.error.invalidAddress
      }

      for (let i = 0; i <= 12; i++) {
        // process all 64 bits (even if name is short)
        let c = i < name.length ? charidx(name[i]) : 0
        let bitlen = i < 12 ? 5 : 4
        let bits = Number(c).toString(2)
        if (bits.length > bitlen) {
          console.warn('checkEosAddress Invalid name ' + name)
          throw D.error.invalidAddress
        }
        bits = '0'.repeat(bitlen - bits.length) + bits
      }
    },

    eosPrivateToPublicBuffer (privateKey) {
      try {
        let keyPair = bitcoin.ECPair.fromWIF(privateKey)
        keyPair.compressed = true
        return keyPair.getPublicKeyBuffer()
      } catch (e) {
        console.warn('eosPrivateToPublicBuffer error', e)
        throw D.error.invalidParams
      }
    },

    parseEosPrivateKey (privateKey) {
      let buffer
      // normal address, base58 encoded
      try {
        buffer = base58check.decode(privateKey)
      } catch (e) {
        console.warn('privateKey is not base58 encoded', privateKey)
        throw D.error.invalidParams
      }
      if (buffer.length !== 33) {
        console.warn('privateKey length invalid', privateKey)
        throw D.error.invalidParams
      }
      if (buffer[0] !== 0x80) {
        console.warn('privateKey first byte not 0x80', privateKey)
        throw D.error.invalidParams
      }
      return buffer.slice(1, 33)
    },

    checkBtcAddress (coinType, address) {
      let buffer
      // normal address, base58 encoded
      try {
        buffer = base58check.decode(address)
      } catch (e) {
        console.debug('address', address, 'is not base58 encoded')
      }

      let assertNet = (coinType, netType) => {
        let isTest = Object.values(D.coin.test).includes(coinType)
        let assertTest = netType === 'test'
        if (isTest !== assertTest) {
          console.warn('btc network type unmatched', coinType, address)
          throw D.error.invalidAddress
        }
      }

      if (buffer && buffer.length === 21) {
        let network = buffer.readUInt8(0)
        switch (network) {
          case 0: // main net P2PKH
            assertNet(coinType, 'main')
            return D.address.p2pkh
          case 0x05: // main net P2SH
            assertNet(coinType, 'main')
            return D.address.p2sh
          case 0x6f: // test net P2PKH
            assertNet(coinType, 'test')
            return D.address.p2pkh
          case 0xc4: // test net P2SH
            assertNet(coinType, 'test')
            return D.address.p2sh
          default:
            throw D.error.invalidAddress
        }
      }

      // publickey
      if (buffer && buffer.length === 78) {
        let versionBytes = buffer.readUInt32BE(0)
        switch (versionBytes) {
          case 0x0488B21E: // main net
            if (D.test.coin) throw D.error.invalidAddress
            return D.address.p2pk
          case 0x043587CF: // test net
            // bitcoin-js dont support p2pk
            throw D.error.invalidAddress
            // if (!D.test.coin) throw D.error.invalidAddress
            // return D.address.p2pk
          default:
            throw D.error.invalidAddress
        }
      }

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

        // hardware wallet not support yet
        if (!D.test.jsWallet) throw D.error.invalidAddress
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

    makeOutputScript (coinType, address) {
      let type = D.address.checkBtcAddress(coinType, address)
      let scriptPubKey
      switch (type) {
        case D.address.p2pk:
          scriptPubKey = '21' + D.address.toBuffer(address).toString('hex') + 'AC'
          break
        case D.address.p2pkh:
          scriptPubKey = '76A914' + D.address.toBuffer(address).toString('hex') + '88AC'
          break
        case D.address.p2sh:
          scriptPubKey = 'A914' + D.address.toBuffer(address).toString('hex') + '87'
          break
        case D.address.p2wpkh:
          scriptPubKey = '0014' + D.address.toBuffer(address).toString('hex')
          break
        case D.address.p2wsh:
          scriptPubKey = '0020' + D.address.toBuffer(address).toString('hex')
          break
        default:
          console.warn('makeOutputScript: unsupported address type')
          throw D.error.invalidAddress
      }
      return scriptPubKey
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
      if (typeof address !== 'string') {
        console.warn('toBuffer invalid arguments', address)
        throw D.error.invalidParams
      }
      if (address.startsWith('EOS')) {
        address = address.slice(3, address.length)
        return base58check.decode(address)
      } else if (address.startsWith('0x')) {
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
            console.debug('address not bech32 encoded', address)
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
          if (buffer.length !== 21) {
            console.warn('btc p2pkh/p2sh address length unmatched', address, buffer.length)
            throw D.error.invalidAddress
          }
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
          if (buffer.length !== 78) {
            console.warn('btc p2pk address lenght unmatched', address, buffer.length)
            throw D.error.invalidAddress
          }
          return buffer.slice(45)
        }
        console.warn('no matching prefix for bitcoin address', address)
        throw D.error.invalidAddress
      }
    },

    toString (coinType, address) {
      if (D.isEth(coinType) && address.length === 20) {
        // eth
        return D.address.toEthChecksumAddress(address)
      } else if (D.isBtc(coinType) && address.length === 21) {
        // bitcoin
        return base58check.encode(Buffer.from(address))
      } else if (D.isEos(coinType) && address.length === 33) {
        let checksum = createHash('ripemd160').update(address).digest().slice(0, 4)
        address = 'EOS' + base58.encode(Buffer.concat([address, checksum]))
        return address
      } else {
        console.warn('address toString don\'t support this coinType and address', coinType, address)
        throw D.error.coinNotSupported
      }
    },

    path: {
      toArray (path) {
        if (typeof path !== 'string') {
          console.warn('D.address.path.toArray invalid path', path)
          throw D.error.invalidParams
        }

        let parts = path.split('/')
        if (parts[0] === 'm') parts = parts.slice(1)

        let values = []
        for (let part of parts) {
          let value = 0
          if (part[part.length - 1] === "'") {
            part = part.slice(0, part.length - 1)
            value += 0x80000000
          }
          let num = Number(part)
          if (Number.isNaN(num)) {
            console.warn('D.address.path.toArray invalid index', part, path)
            throw D.error.invalidParams
          }
          value += num
          values.push(value)
        }
        return values
      },

      /**
       * convert string type path to Buffer
       */
      toBuffer (path) {
        let indexes = this.toArray(path)
        let buffer = Buffer.allocUnsafe(indexes.length * 4)
        indexes.forEach((index, i) => {
          buffer[4 * i] = index >> 24
          buffer[4 * i + 1] = index >> 16
          buffer[4 * i + 2] = index >> 8
          buffer[4 * i + 3] = index
        })
        return buffer
      },

      fromBuffer (path) {
        let level = path.length / 4
        let indexes = []
        for (let i = 0; i < level; i++) {
          indexes.push(path.readUInt32BE(i * 4, 4))
        }
        return this.makePath(indexes)
      },

      makeBip44Path (coinType, accountIndex, type = undefined, addressIndex = undefined) {
        coinType = typeof coinType === 'number' ? coinType : D.getCoinIndex(coinType)
        let indexes = [44, coinType, accountIndex]
        if (type !== undefined) {
          type = type === D.address.external ? 0 : 1
          indexes.push(type)

          if (addressIndex !== undefined) {
            indexes.push(addressIndex)
          }
        }
        return this.makePath(indexes, 3)
      },

      makeSlip48Path (coinType, permissionIndex, accountIndex, keyIndex = undefined) {
        coinType = typeof coinType === 'number' ? coinType : D.getCoinIndex(coinType)
        let indexes = [48, coinType, permissionIndex, accountIndex]
        if (keyIndex !== undefined) {
          indexes.push(keyIndex)
        }
        return this.makePath(indexes, indexes.length)
      },

      makePath (indexes, hardLevel = 0) {
        let path = 'm'
        indexes.forEach((index, i) => {
          path += '/'
          let hard = false
          if (index >= 0x80000000) {
            hard = true
            index -= 0x80000000
          }
          path += index.toString()
          if (hard || (i < hardLevel)) {
            path += "'"
          }
        })
        return path
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

    /**
     *   -2: dropped by network peer from memeory pool
     *   -1: not found in network
     *   0: found in miner's memory pool.
     *   other: confirmations just for showing the status.
     *          won't be updated after confirmations >= D.tx.matureConfirms.coinType
     */
    confirmation: {
      dropped: -2,
      pending: -1,
      inMemory: 0,
      waiting: 0, // for eos
      executed: 1 // for eos
    },

    getMatureConfirms (coinType) {
      if (D.isBtc(coinType)) {
        return D.tx.matureConfirms.btc
      } else if (D.isEth(coinType)) {
        return D.tx.matureConfirms.eth
      } else {
        console.warn('getMatureConfirms don\'t supoort this coinType', coinType)
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
    eos: {
      EOS: 'EOS'
    },
    legal: {
      USD: 'USD',
      EUR: 'EUR',
      CNY: 'CNY',
      JPY: 'JPY'
    }
  },

  isBtc (coinType) {
    return coinType && coinType.startsWith('btc')
  },

  isEth (coinType) {
    return coinType && coinType.startsWith('eth')
  },

  isEos (coinType) {
    return coinType && coinType.startsWith('eos')
  },

  suppertedLegals () {
    return Object.values(this.unit.legal)
  },

  supportedCoinTypes () {
    return D.test.coin
      ? [D.coin.test.btcTestNet3, D.coin.test.ethRinkeby, D.coin.test.eosJungle]
      : [D.coin.main.btc, D.coin.main.eth, D.coin.main.eos]
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
      if (!value.match(/^[-0-9.]+$/)) throw D.error.valueIsNotDecimal
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
      if (!value.match(/^[-0-9.]+$/)) throw D.error.valueIsNotDecimal
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
    if (D.isBtc(coinType)) {
      return convertBtc(value, fromType, toType)
    } else if (D.isEth(coinType)) {
      return convertEth(value, fromType, toType)
    } else if (D.isEos(coinType)) {
      return value
    } else {
      console.warn('convertValue don\'t support this coinType', coinType)
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
    return num && num.toString().includes('.')
  },

  getCoinIndex (coinType) {
    if (D.isBtc(coinType)) {
      // bip-0044
      return 0
    } else if (D.isEth(coinType)) {
      // bip-0044
      return 60
    } else if (D.isEos(coinType)) {
      // slip-0048
      return 4
    } else {
      console.warn('getCoinIndex don\'t support this coinType', coinType)
      throw D.error.coinNotSupported
    }
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
    if (object === undefined) return object
    if (object === null) return object
    return JSON.parse(JSON.stringify(object))
  },

  strToUtf8 (str) {
    let utf8 = []
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i)
      if (charcode < 0x80) utf8.push(charcode)
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6),
          0x80 | (charcode & 0x3f))
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f))
      } else {
        // surrogate pair
        i++
        // UTF-16 encodes 0x10000-0x10FFFF by
        // subtracting 0x10000 and splitting the
        // 20 bits of 0x0-0xFFFFF into two halves
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) |
          (str.charCodeAt(i) & 0x3ff))
        utf8.push(0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f))
      }
    }
    return Buffer.from(utf8)
  },

  http: {
    get (url) {
      return new Promise((resolve, reject) => {
        console.debug('get', url)
        let xmlhttp = new XMLHttpRequest()
        xmlhttp.onreadystatechange = () => {
          if (xmlhttp.readyState === 4) {
            console.debug('get response', xmlhttp.responseText)
            if (xmlhttp.status === 200 || xmlhttp.status === 202) {
              try {
                resolve(JSON.parse(xmlhttp.responseText))
              } catch (e) {
                resolve({response: xmlhttp.responseText})
              }
            } else if (xmlhttp.status === 500) {
              console.warn(url, xmlhttp)
              reject(D.error.networkProviderError)
            } else {
              console.warn(url, xmlhttp)
              reject(D.error.networkUnavailable)
            }
          }
        }
        xmlhttp.open('GET', url, true)
        xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
        xmlhttp.send()
      })
    },

    post (url, args = '', type = 'application/x-www-form-urlencoded') {
      console.debug('post', url, args)
      return new Promise((resolve, reject) => {
        const xmlhttp = new XMLHttpRequest()
        xmlhttp.onreadystatechange = () => {
          if (xmlhttp.readyState === 4) {
            console.debug('post response', xmlhttp.responseText)
            if (xmlhttp.status === 200 || xmlhttp.status === 202) {
              try {
                resolve(JSON.parse(xmlhttp.responseText))
              } catch (e) {
                resolve({response: xmlhttp.responseText})
              }
            } else if (xmlhttp.status === 500) {
              console.warn(url, xmlhttp)
              reject(D.error.networkProviderError)
            } else {
              console.warn(url, xmlhttp)
              reject(D.error.networkUnavailable)
            }
          }
        }
        xmlhttp.open('POST', url, true)
        xmlhttp.setRequestHeader('Content-type', type)
        xmlhttp.send(args)
      })
    }
  },

  test: {
    coin: true,
    jsWallet: true,
    mockTransmitter: false,
    mockDevice: false,

    generateSeed () {
      return D.getRandomHex(64)
    }
  }
}
export default D
