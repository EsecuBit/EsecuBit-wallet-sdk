
import D from '../../D'
import rlp from 'rlp'
import BigInteger from 'bigi'
import bitPony from 'bitpony'
import {Buffer} from 'buffer'
import createHash from 'create-hash'
import base58 from 'bs58'
import FcBuffer from './protocol/EosFcBuffer'
import HandShake from './protocol/HandShake'
import Authenticate from './protocol/Authenticate'
import Settings from '../../Settings'
import Provider from '../../Provider'

const getAppId = (coinType) => {
  if (coinType === D.coin.other.hdwallet) {
    return '010102'
  } else if (coinType === D.coin.other.manager) {
    return '010202'
  } else if (coinType === D.coin.other.backup) {
    return '010302'
  } else if (D.isBtc(coinType)) {
    return '020002'
  } else if (D.isEth(coinType)) {
    return '023C02'
  } else if (D.isEos(coinType)) {
    return '02C202'
  } else {
    console.warn('unknown coinType for appId', coinType)
    throw D.error.coinNotSupported
  }
}

// rewrite _containKeys to make empty value available, so we can use it to build presign tx
// noinspection JSPotentiallyInvalidConstructorUsage
bitPony.prototype._containKeys = function (keys) {
  for (let i of keys) {
    if (this.data[i] === null) {
      throw new Error('key ' + this.type + '.' + i + ' can not be null ' + this.data[i])
    }
  }
}

export default class S300Wallet {
  constructor (transmitter) {
    this._transmitter = transmitter
    this._currentApp = null
    this._allEnc = false
  }

  async init (authCallback) {
    console.log('S300Wallet init')

    this._currentApp = null
    await this._transmitter.reset()

    // authenticate
    if (!authCallback) {
      console.warn('S300Wallet auth missing authCallback')
      authCallback = () => {}
    }
    let deivceName = this._transmitter.getName && this._transmitter.getName()
    let oldFeature = await new Settings().getSetting('netBankFeature', deivceName)
    console.log('S300Wallet old feature', oldFeature)
    oldFeature = oldFeature && Buffer.from(oldFeature, 'hex')

    let newFeature
    while (true) {
      let authenticate = new Authenticate('Esecubit', this, oldFeature)
      try {
        newFeature = await authenticate.prepareAuth()
        if (!oldFeature) {
          let pairCode = String.fromCharCode.apply(null,
            newFeature.slice(newFeature.length - 4))
          D.dispatch(() => authCallback(D.status.auth, pairCode))
        }
        console.log('S300Wallet do authenticate')
        await authenticate.auth()
        console.log('S300Wallet authenticate succeed')
        D.dispatch(() => authCallback(D.status.authFinish))

        if (!oldFeature) {
          let featureHex = newFeature.toString('hex')
          await new Settings().setSetting('netBankFeature', featureHex, deivceName)
          console.log('S300Wallet new feature', featureHex)
        }
        break
      } catch (e) {
        if (e === D.error.deviceApduDataInvalid) {
          console.info('S300Wallet authenticate not support, ignore')
          break
        } else if (e === D.error.deviceNeedReauthenticate) {
          await new Settings().setSetting('netBankFeature', null, deivceName)
          oldFeature = null
        } else {
          console.warn('S300Wallet autenticate failed', e)
          throw e
        }
      }
    }

    this._handShake = new HandShake(oldFeature || newFeature, HandShake.SM2)
    let walletId = D.test.coin ? '01' : '00'
    walletId += D.test.jsWallet ? '01' : '00'
    walletId += (await this.getWalletId()).toString('hex')

    // async handshake
    this._allEnc = true
    // noinspection JSIgnoredPromiseFromCall
    this.getWalletId()

    return {walletId: walletId}
  }

  async reset () {
    this._version = {}
    this._currentApp = null
  }

  async getWalletInfo () {
    let appletVersions = await this._getAppletVersions()
    let cosVersion = appletVersions.reduce((hex, version) => {
      if (version.installed) {
        return hex + '_' + version.rawHex
      } else {
        return hex
      }
    }, '')
    return {
      sdk_version: D.sdkVersion,
      cos_version: cosVersion,
      applet_versions: appletVersions
    }
  }

  async getWalletId () {
    return this.sendApdu('8070000000', false, D.coin.other.hdwallet)
  }

  async getWalletBattery () {
    let response = await this.sendApdu('8034000000', false, D.coin.other.manager)
    let isCharging = (response[0] & 0x80) === 0x80
    let level = response[0] & 0x03
    return {
      level, isCharging
    }
  }

  async _getAppletVersions () {
    this._version = this._version || []

    if (this._version.length > 0) {
      return this._version
    } else if (this._versionTask) {
      return this._versionTask
    }

    this._versionTask = new Promise(async (resolve) => {
      this._version.push(await this._getVersionInfo('HDWallet', D.coin.other.hdwallet))
      this._version.push(await this._getVersionInfo('Manager', D.coin.other.manager))
      this._version.push(await this._getVersionInfo('Backup', D.coin.other.backup))
      this._version.push(await this._getVersionInfo('BTC', D.coin.main.btc))
      this._version.push(await this._getVersionInfo('ETH', D.coin.main.eth))
      this._version.push(await this._getVersionInfo('EOS', D.coin.main.eos))
      this._versionTask = null
      resolve(this._version)
    })

    return this._versionTask
  }

  async _getVersionInfo (name, coinType) {
    try {
      let response = await this.sendApdu('804A000000', false, coinType)
      return {
        name: name,
        installed: true,
        rawHex: response.toString('hex'),
        appletId: response.slice(0, 3).toString('hex'),
        packageId: response.slice(0, 2).toString('hex') + '01',
        isTestApplet: response[3] === 1,
        version: response[4] + '.' + response[5] + '.' + response[6],
        date: response.slice(7, 12).toString('hex'),
        coinType: coinType
      }
    } catch (e) {
      return {
        name: name,
        installed: false
      }
    }
  }

  async getPublicKey (coinType, path, isShowing = false) {
    // see getAddress
    let flag = isShowing ? 0x02 : 0x00

    let apduHead = Buffer.from('804600001505', 'hex')
    let pathBuffer = D.address.path.toBuffer(path)
    let apdu = Buffer.concat([apduHead, pathBuffer])
    apdu[3] = flag
    let publicKey = await this.sendApdu(apdu, false, coinType)
    return publicKey.toString('hex')
  }

  async getAddress (coinType, path, isShowing = false, isStoring = false) {
    // bit 0: 0 not save on key / 1 save on key
    // bit 1: 0 not show on key / 1 show on key
    // bit 2: 0 public key / 1 address
    // bit 3: 0 uncompressed / 1 compressed
    // if bit2 == 0, bit0 == bit1 == 0
    let flag = 0
    flag += isStoring ? 0x01 : 0x00
    flag += isShowing ? 0x02 : 0x00
    flag += 0x04
    flag += !D.isEth(coinType) && 0x08 // compressed if not ETH
    if (D.isEos(coinType)) {
      flag &= 0xfc
    }

    let apduHead = Buffer.from('804600001505', 'hex')
    let pathBuffer = D.address.path.toBuffer(path)
    let apdu = Buffer.concat([apduHead, pathBuffer])
    apdu[3] = flag

    let response = await this.sendApdu(apdu, false, coinType)
    let address = String.fromCharCode.apply(null, new Uint8Array(response))
    // device only return mainnet address
    if (coinType === D.coin.test.btcTestNet3) {
      let addressBuffer = D.address.toBuffer(address)
      addressBuffer = Buffer.concat([Buffer.from('6F', 'hex'), addressBuffer])
      address = D.address.toString(coinType, addressBuffer)
    }

    return address
  }

  async getDeriveData (coinType, path) {
    if (!D.isBtc(coinType)) {
      console.warn('getDeriveData only supports BTC', coinType)
      throw D.error.coinNotSupported
    }

    let apduHead = Buffer.from('804C00000D03', 'hex')
    let pathBuffer = D.address.path.toBuffer(path)
    let apdu = Buffer.concat([apduHead, pathBuffer])

    let response = await this.sendApdu(apdu, true, coinType)
    return {
      publicKey: response.slice(0, 33).toString('hex'),
      chainCode: response.slice(33, 65).toString('hex')
    }
  }

  async getAddresses (coinType, publicKey, chainCode, type, fromIndex, toIndex) {
    if (!D.isBtc(coinType)) {
      console.warn('getAddresses only supports BTC', coinType)
      throw D.error.coinNotSupported
    }

    type = type === D.address.external ? 0 : 1
    let network = D.coin.params.btc.getNetwork(coinType)
    return Provider.Crypto.deriveAddresses(network.pubKeyHash, publicKey, chainCode, type, fromIndex, toIndex)
  }

  async getAccountName (coinType, accountIndex, pmData, isShowing = false, isStoring = false) {
    if (!D.isEos(coinType)) {
      console.warn('getAccountName only supports EOS', coinType)
      throw D.error.coinNotSupported
    }
    let flag = 0
    flag += isStoring ? 0x01 : 0x00
    flag += isShowing ? 0x02 : 0x00

    let apduHead = Buffer.from('8076000000', 'hex')
    let data
    let isKey = pmData.startsWith('import_')
    if (isKey) {
      let accountIndexBuffer = Buffer.allocUnsafe(4)
      accountIndexBuffer.writeUInt32BE(accountIndex + 0x80000000, 0)

      let startIndex = pmData.indexOf('EOS') + 'EOS'.length
      let keyData = base58.decode(pmData.slice(startIndex)).slice(0, -4)
      data = Buffer.concat([accountIndexBuffer, keyData])
    } else {
      data = D.address.path.toBuffer(pmData)
    }
    let apdu = Buffer.concat([apduHead, data])
    apdu[2] = isKey ? 0x01 : 0x00
    apdu[3] = flag
    apdu[4] = data.length

    let response = await this.sendApdu(apdu, false, coinType)
    return String.fromCharCode.apply(null, new Uint8Array(response))
  }

  async getDefaultPermissions (coinType, accountIndex) {
    if (!D.isEos(coinType)) {
      console.warn('getDefaultPermissions only supports EOS', coinType)
      throw D.error.coinNotSupported
    }
    accountIndex += 0x80000000
    if (accountIndex < 0x80000000 || accountIndex > 0xFFFFFFFF) {
      console.warn('accountIndex out of range', accountIndex)
      throw D.error.invalidParams
    }

    let apdu = Buffer.from('807400000400000000', 'hex')
    apdu[5] = (accountIndex >> 24) & 0xff
    apdu[6] = (accountIndex >> 16) & 0xff
    apdu[7] = (accountIndex >> 8) & 0xff
    apdu[8] = accountIndex & 0xff

    await this.sendApdu(apdu, true, coinType)
  }

  async getPermissions (coinType, accountIndex) {
    if (!D.isEos(coinType)) {
      console.warn('getPermissions only supports EOS', coinType)
      throw D.error.coinNotSupported
    }

    let offset = 0
    let permissions = []
    while (true) {
      let apdu = Buffer.from('807800000100', 'hex')
      apdu[5] = offset
      let response = await this.sendApdu(apdu, false, coinType)
      let returnPmSize = response[1]
      const pmDataSize = 54 // Math.max(size(type0)=37, size(type1)=54)
      for (let i = 0; i < returnPmSize; i++) {
        permissions.push(response.slice(2 + i * pmDataSize, 2 + (i + 1) * pmDataSize))
      }

      let remainPmSize = response[0]
      if (remainPmSize === 0) {
        break
      }
      offset += returnPmSize
    }

    permissions = permissions.reduce((pms, pm) => {
      let type = pm[0]
      let data
      // type[1] actor[8] name[8] path[20]
      if (type === 0) {
        let pmAccountIndex = pm.readUInt32BE(1 + 8 + 8 + 4 * 2) // accountIndex in path
        if (pmAccountIndex !== (0x80000000 + accountIndex)) {
          return pms
        }

        data = pm.slice(17, 37)
        data = D.address.path.fromBuffer(data)
      // type[1] actor[8] name[8] account[4] publicKey[33]
      } else if (type === 1) {
        let pmAccountIndex = pm.readUInt32BE(1 + 8 + 8) // accountIndex in path
        if (pmAccountIndex !== (0x80000000 + accountIndex)) {
          return pms
        }

        data = pm.slice(21, 54)
        data = D.address.toString(coinType, data)
      } else {
        console.warn('getPermissions unknown type', type)
        return pms
      }
      pms.push({
        type,
        actor: FcBuffer.name.decodeName(pm.slice(1, 9)),
        name: FcBuffer.name.decodeName(pm.slice(9, 17)),
        data
      })
      return pms
    }, [])

    console.info('S300Wallet getPermissions', JSON.stringify(permissions))
    return permissions
  }

  async addPermission (coinType, pmInfo) {
    if (!D.isEos(coinType)) {
      console.warn('addPermission only supports EOS', coinType)
      throw D.error.coinNotSupported
    }

    // 8070 0000 lc actor[8] name[8] path[20]
    let apduHead = Buffer.from('8070000000', 'hex')
    let data = Buffer.concat([
      FcBuffer.name.toBuffer(pmInfo.address), // actor
      FcBuffer.name.toBuffer(pmInfo.type), // name
      D.address.path.toBuffer(pmInfo.path) // path
    ])
    let apdu = Buffer.concat([apduHead, data])
    apdu[0x04] = data.length

    await this.sendApdu(apdu, true, coinType)
  }

  async removePermission (coinType, pmInfo) {
    if (!D.isEos(coinType)) {
      console.warn('removePermission only supports EOS', coinType)
      throw D.error.coinNotSupported
    }

    // 8072 0000 lc actor[8] name[8] path[20]
    let apduHead = Buffer.from('8072000000', 'hex')
    let data = Buffer.concat([
      FcBuffer.name.toBuffer(pmInfo.address), // actor
      FcBuffer.name.toBuffer(pmInfo.type), // name
      D.address.path.toBuffer(pmInfo.path) // path
    ])
    let apdu = Buffer.concat([apduHead, data])
    apdu[0x04] = data.length

    await this.sendApdu(apdu, true, coinType)
  }

  async importKey (coinType, keyInfo) {
    if (!D.isEos(coinType)) {
      console.warn('importKey only supports EOS', coinType)
      throw D.error.coinNotSupported
    }

    let accountIndexBuffer = Buffer.allocUnsafe(4)
    accountIndexBuffer.writeUInt32BE(keyInfo.accountIndex + 0x80000000, 0)

    let keyBuffer = D.address.parseEosPrivateKey(keyInfo.key)
    // 8072 0100 lc actor[8] name[8] accountIndex[4] key[32]
    let apduHead = Buffer.from('8070010000', 'hex')
    let data = Buffer.concat([
      FcBuffer.name.toBuffer(keyInfo.address), // actor
      FcBuffer.name.toBuffer(keyInfo.type), // name
      accountIndexBuffer, // accountIndex
      keyBuffer // private key
    ])
    let apdu = Buffer.concat([apduHead, data])
    apdu[0x04] = data.length

    await this.sendApdu(apdu, true, coinType)
  }

  async removeKey (coinType, keyInfo) {
    if (!D.isEos(coinType)) {
      console.warn('importKey only supports EOS', coinType)
      throw D.error.coinNotSupported
    }

    let accountIndexBuffer = Buffer.allocUnsafe(4)
    accountIndexBuffer.writeUInt32BE(keyInfo.accountIndex + 0x80000000, 0)

    let keyBuffer = D.address.toBuffer(keyInfo.publicKey)
    // 8072 0100 lc actor[8] name[8] accountIndex[4] key[33]
    let apduHead = Buffer.from('8072010000', 'hex')
    let data = Buffer.concat([
      FcBuffer.name.toBuffer(keyInfo.address), // actor
      FcBuffer.name.toBuffer(keyInfo.type), // name
      accountIndexBuffer, // accountIndex
      keyBuffer // public key
    ])
    let apdu = Buffer.concat([apduHead, data])
    apdu[0x04] = data.length

    await this.sendApdu(apdu, true, coinType)
  }

  async setAmountLimit (coinType, amountLimit) {
    if (!D.isEos(coinType)) {
      throw D.error.coinNotSupported
    }

    // 807A 0000 lc amountLimit[8]
    let apduHead = Buffer.from('807A000000', 'hex')
    let data = FcBuffer.uint64.toBuffer(amountLimit.replace('.', ''))
    let apdu = Buffer.concat([apduHead, data])
    apdu[0x04] = data.length

    await this.sendApdu(apdu, true, coinType)
  }

  async addToken (coinType, token) {
    if (!D.isEth(coinType)) {
      throw D.error.coinNotSupported
    }
    // 8070 0000 len nameLength[1] name[nameLength] decimals[1] address[20]
    let apdu = Buffer.allocUnsafe(4 + 23 + token.name.length)
    Buffer.from('80700000', 'hex').copy(apdu)
    apdu[4] = 23 + token.name.length
    apdu[5] = token.name.length
    for (let i = 0; i < token.name.length; i++) {
      apdu[6 + i] = token.name.charCodeAt(i)
    }
    apdu[6 + token.name.length] = token.decimals
    D.address.toBuffer(token.address).copy(apdu, 2 + token.name.length)
    await this.sendApdu(apdu, true, coinType)
  }

  async removeToken (coinType, token) {
    if (!D.isEth(coinType)) {
      throw D.error.coinNotSupported
    }
    // 8072 0000 len address[20]
    let apdu = Buffer.allocUnsafe(5 + 20)
    Buffer.from('8072000014', 'hex').copy(apdu)
    D.address.toBuffer(token.address).copy(apdu, 5)
    await this.sendApdu(apdu, true, coinType)
  }

  /**
   * tx:
   * btc:
   * {
   *   inputs: [{
   *     address: base58 string,
   *     path: string,
   *     txId: hex string,
   *     index: number,
   *     script: string,
   *   }],
   *   outputs: [{
   *     address: base58 string,
   *     value: number
   *   }]
   *   changePath: string,
   * }
   *
   * eth:
   * {
   *   input: {
   *     address: 0x string,
   *     path: string,
   *   ],
   *   output: {
   *     address: 0x string,
   *     value: number
   *   },
   *   nonce: number,
   *   gasPrice: 0x string,
   *   gasLimit: 0x string,
   *   data: 0x string,
   * }
   */
  async signTransaction (coinType, tx) {
    // for btc and eth
    let buildSign = (path, changePath, msg) => {
      // 8048 state flag length C0 u1PathNum pu1Path C1 u1ChangePathNum pu1ChangePath C2 xxxx pu1Msg
      let dataLength =
        2 + path.length +
        (changePath ? (2 + changePath.length) : 2) +
        3 + msg.length

      let data = Buffer.allocUnsafe(dataLength)
      let index = 0
      data[index++] = 0xC0
      data[index++] = path.length / 4
      path.copy(data, index)
      index += path.length

      data[index++] = 0xC1
      data[index++] = changePath ? (changePath.length / 4) : 0
      if (changePath) changePath.copy(data, index)
      index += changePath ? changePath.length : 0

      data[index++] = 0xC2
      data[index++] = msg.length >> 8
      data[index++] = msg.length
      msg.copy(data, index)

      return data
    }

    let sendSign = async (data, isCompressed) => {
      let compressChange = 0x08
      let response
      if (data.length <= 0xFF) {
        let apduHead = Buffer.from('8048030000', 'hex')
        isCompressed && (apduHead[3] |= compressChange)
        apduHead[4] = data.length
        response = await this.sendApdu(Buffer.concat([apduHead, data]), true, coinType)
      } else {
        let remainLen = data.length
        // devide tx to sign due to wallet command length limit
        while (true) {
          if (remainLen <= 0xFF) {
            let apduHead = Buffer.from('8048020000', 'hex')
            apduHead[3] |= compressChange
            apduHead[4] = remainLen
            let offset = data.length - remainLen
            response = await this.sendApdu(Buffer.concat([apduHead, data.slice(offset, data.length)]), true, coinType)
            break
          } else if (remainLen === data.length) {
            // first package
            let apduHead = Buffer.from('80480100FF', 'hex')
            await this.sendApdu(Buffer.concat([apduHead, data.slice(0, 0xFF)]), true)
          } else {
            // middle package
            let apduHead = Buffer.from('80480000FF', 'hex')
            apduHead[3] |= compressChange
            let offset = data.length - remainLen
            await this.sendApdu(Buffer.concat([apduHead, data.slice(offset, offset + 0xFF)]), true, coinType)
          }
          remainLen -= 0xFF
        }
      }
      return response
    }

    let parseSignResponse = (coinType, response) => {
      let remain = 0
      if (D.isEos(coinType)) {
        remain = response[0]
        response = response.slice(1)
      }

      let r = response.slice(0, 32)
      let s = response.slice(32, 64)
      let pubKey = response.slice(64, 128)
      let v = response[128] % 2

      let n = BigInteger.fromHex('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')
      const N_OVER_TWO = n.shiftRight(1)
      let sInt = BigInteger.fromBuffer(s)
      if (sInt.compareTo(N_OVER_TWO) > 0) {
        console.debug('s > N/2, s = N/2 - r, old s, v', s.toString('hex'), v)
        sInt = n.subtract(sInt)
        let sHex = sInt.toHex()
        sHex = (sHex.length % 2) ? ('0' + sHex) : sHex
        s = Buffer.from(sHex, 'hex')
        v = v ? 0 : 1
        console.debug('new s, v', s.toString('hex'), v)
      }
      return {remain, v, r, s, pubKey}
    }

    let signBtc = async (coinType, tx) => {
      let makeBasicScript = (tx) => {
        return {
          version: 1,
          inputs: tx.inputs.map(input => {
            return {
              hash: input.txId,
              index: input.index,
              scriptSig: input.script,
              sequence: 0xFFFFFFFD // opt-in full-RBF, BIP 125
            }
          }),
          outputs: tx.outputs.map(output => {
            let scriptPubKey = D.address.makeOutputScript(coinType, output.address)
            return {
              amount: output.value,
              scriptPubKey: scriptPubKey
            }
          }),
          lockTime: 0
        }
      }

      let makePreSignScript = (i, basicScript) => {
        let script = D.copy(basicScript)
        script.inputs.forEach((input, j) => {
          if (i !== j) input.scriptSig = ''
        })
        let preSignScript = bitPony.tx.write(
          script.version, script.inputs, script.outputs, script.lockTime)
        return Buffer.concat([preSignScript, Buffer.from('01000000', 'hex')])
      }

      let makeScriptSig = (r, s, pubKey) => {
        // DER encode
        let scriptSigLength = 0x03 + 0x22 + 0x22 + 0x01 + 0x22
        // s must < N/2, r has no limit
        let upperR = r[0] >= 0x80
        if (upperR) scriptSigLength++

        let scriptSig = Buffer.allocUnsafe(scriptSigLength)
        let index = 0
        let sigLength = 0x22 + 0x22 + (upperR ? 0x01 : 0x00)
        scriptSig[index++] = 0x03 + sigLength
        scriptSig[index++] = 0x30
        scriptSig[index++] = sigLength
        // r
        scriptSig[index++] = 0x02
        scriptSig[index++] = upperR ? 0x21 : 0x20
        if (upperR) scriptSig[index++] = 0x00
        r.copy(scriptSig, index)
        index += r.length
        // s
        scriptSig[index++] = 0x02
        scriptSig[index++] = 0x20
        s.copy(scriptSig, index)
        index += s.length
        // hashType
        scriptSig[index++] = 0x01
        // pubKey, compressed type
        scriptSig[index++] = 0x21
        scriptSig[index++] = pubKey[63] % 2 === 0 ? 0x02 : 0x03
        pubKey = pubKey.slice(0, 32)
        pubKey.copy(scriptSig, index)

        return scriptSig
      }

      let basicScript = makeBasicScript(tx)
      let signedTx = D.copy(basicScript)
      let changePathBuffer = tx.changePath && D.address.path.toBuffer(tx.changePath)
      // execute in order
      let sequence = Promise.resolve()
      tx.inputs.forEach((input, i) => {
        sequence = sequence.then(async () => {
          let pathBuffer = D.address.path.toBuffer(input.path)
          let preSignScript = makePreSignScript(i, basicScript)
          let apduData = buildSign(pathBuffer, changePathBuffer, preSignScript)
          let response = await sendSign(apduData, true)
          let {r, s, pubKey} = await parseSignResponse(coinType, response)
          let scirptSig = makeScriptSig(r, s, pubKey)
          signedTx.inputs[i].scriptSig = scirptSig.toString('hex')
        })
      })
      await sequence

      signedTx = bitPony.tx.write(signedTx.version, signedTx.inputs, signedTx.outputs, signedTx.lockTime).toString('hex')
      return {
        id: bitPony.tx.read(signedTx).hash,
        hex: signedTx
      }
    }

    let signEth = async (coinType, tx) => {
      let chainId = D.coin.params.eth.getChainId(coinType)

      // rlp
      let unsignedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data, chainId, 0, 0]
      let rlpUnsignedTx = rlp.encode(unsignedTx)

      let apduData = buildSign(D.address.path.toBuffer(tx.input.path), null, rlpUnsignedTx)
      let response = await sendSign(apduData)
      let {v, r, s} = await parseSignResponse(coinType, response)
      let signedTx = [tx.nonce, tx.gasPrice, tx.gasLimit, tx.output.address, tx.output.value, tx.data,
        35 + chainId * 2 + (v % 2), r, s]
      let rawTx = rlp.encode(signedTx).toString('hex')
      let txId = D.address.keccak256(rlp.encode(signedTx))
      return {
        id: txId,
        hex: rawTx
      }
    }

    let signEos = async (coinType, tx) => {
      let chainId = D.coin.params.eos.getChainId(coinType)

      let rawTx = FcBuffer.serializeTx(tx)
      console.log('signEos rawTx', rawTx.toString('hex'))
      let packedContextFreeData = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      let signBuf = Buffer.concat([chainId, rawTx, packedContextFreeData])

      let signedTx = {
        compression: 'none',
        packedContextFreeData: '',
        packed_trx: rawTx.toString('hex'),
        signatures: []
      }

      while (true) {
        let response = await sendSign(signBuf)
        let {remain, v, r, s} = parseSignResponse(coinType, response)
        let i = v + 4 + 27
        let buffer = Buffer.allocUnsafe(65)
        buffer.writeUInt8(i, 0)
        r.copy(buffer, 1)
        s.copy(buffer, 33)

        let checkBuffer = Buffer.concat([buffer, Buffer.from('K1')])
        let check = createHash('ripemd160').update(checkBuffer).digest().slice(0, 4)
        let signature = base58.encode(Buffer.concat([buffer, check]))
        signedTx.signatures.push('SIG_K1_' + signature)

        if (remain === 0) break
      }

      let txId = createHash('sha256').update(rawTx).digest().toString('hex')
      return {txId, signedTx}
    }

    if (D.isBtc(coinType)) {
      return signBtc(coinType, tx)
    } else if (D.isEth(coinType)) {
      return signEth(coinType, tx)
    } else if (D.isEos(coinType)) {
      return signEos(coinType, tx)
    } else {
      console.warn('S300Wallet don\'t support this coinType', coinType)
      throw D.error.coinNotSupported
    }
  }

  /**
   * Apdu encrypt and decrypt
   */
  async sendApdu (apdu, isEnc = false, coinType = null) {
    isEnc = this._allEnc || isEnc
    // a simple lock to guarantee apdu order
    while (this._busy) {
      await D.wait(10)
    }
    this._busy = true

    try {
      let sendEncApdu = async (apdu) => {
        console.log('send apdu', apdu.toString('hex'))
        if (typeof apdu === 'string') {
          apdu = Buffer.from(apdu, 'hex')
        }
        if (isEnc) {
          // 1. some other program may try to send command to device
          // 2. in some limit situation, device is not stable yet
          // try up to 3 times
          await this._doHandShake()
            .catch(() => this._doHandShake())
            .catch(() => this._doHandShake())
          apdu = await this._handShake.encApdu(apdu)
          console.debug('send enc apdu', apdu.toString('hex'))
        }

        let response = await this._transmit(apdu)
        if (isEnc) {
          console.debug('got enc response', response.toString('hex'))
          let decResponse = await this._handShake.decResponse(response)
          S300Wallet._checkSw1Sw2(decResponse.result)
          response = decResponse.response
        }
        console.log('got response', response.toString('hex'), 'isEnc', isEnc)
        return response
      }

      // select applet if it's not the require applet
      if (coinType) {
        let appId = getAppId(coinType)
        if (this._currentApp !== appId) {
          await sendEncApdu('00A4040008B000000000' + appId)
          this._currentApp = appId
        }
      }
      // use await to make lock works
      let response = await sendEncApdu(apdu)
      return response
    } finally {
      this._busy = false
    }
  }

  async _doHandShake () {
    if (this._handShake.isFinished) return
    let {tempKeyPair, apdu} = await this._handShake.generateHandshakeApdu()
    console.debug('handshake apdu', apdu.toString('hex'))
    let response = await this._transmit(apdu)
    console.debug('handshake apdu response', response.toString('hex'))
    await this._handShake.parseHandShakeResponse(response, tempKeyPair, apdu)
    console.debug('handshake finish')
  }

  /**
   * APDU special response handling
   */
  async _transmit (apdu) {
    let {result, response} = await this._transmitter.transmit(apdu)

    // 9060 means busy, send 00c0000000 immediately to get response
    while (result === 0x9060) {
      let waitCmd = Buffer.from('000C0000000', 'hex')
      let {_result, _response} = await this._transmitter.transmit(waitCmd)
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      console.debug('got 0x61XX, get remain data', result & 0xFF)
      let rApdu = Buffer.from('00C0000000', 'hex')
      rApdu[0x04] = result & 0xFF
      rApdu[0x04] = (rApdu[0x04] && rApdu[0x04]) || 0xFF
      let ret = await this._transmitter.transmit(rApdu)
      response = Buffer.concat([response, ret.response])
      result = ret.result
    }

    S300Wallet._checkSw1Sw2(result)
    return response
  }

  static _checkSw1Sw2 (sw1sw2) {
    let errorCode = D.error.checkSw1Sw2(sw1sw2)
    if (errorCode !== D.error.succeed) throw errorCode
  }
}
