import D from '../../D'
import Crypto from '../implements/protocol/Crypto'
import CryptoJS from 'crypto-js'
import {Buffer} from 'buffer'

const server = 'http://api.esecubit.com/app-update-server/applet/v1/'

export default class UpgradeManager {
  constructor (device) {
    this._device = device
  }

  /**
   * Get managable applet list
   *
   * @returns {Promise<AppletInfo[]>}
   * AppletInfo: {
   *  name: string,
   *  description: string,
   *  installed: boolean,
   *  upgradable: boolean,
   *  versionDescription: string,
   *  version: string,
   *  latestVersion: string,
   *  releaseTime: string,
   *  coinType: string,
   * }
   */
  async getAppletList (productName = 'std') {
    let walletInfo = {}
    let latestAppletVersions = {}
    await Promise.all([
      this._device.getWalletInfo().then(ret => { walletInfo = ret }),
      D.http.get(server + 'version?pro=' + productName).then(ret => { latestAppletVersions = ret })])

    let localAppletVersions = walletInfo.applet_versions
    console.debug('getAppletList appletVersions', localAppletVersions)
    let appletList = []
    for (let appletInfo of latestAppletVersions) {
      let localAppletVersion = localAppletVersions.find(v => v.name === appletInfo.name) || {}
      // noinspection PointlessBooleanExpressionJS
      appletList.push({
        name: appletInfo.name,
        description: appletInfo.description,
        installed: !!localAppletVersion.installed,
        upgradable: !!localAppletVersion.installed && UpgradeManager._isNeedUpgrade(appletInfo.version, localAppletVersion.version),
        versionDescription: appletInfo.versionDescription,
        version: localAppletVersion.version,
        latestVersion: appletInfo.version,
        appletId: appletInfo.appletId,
        packageId: appletInfo.packageId,
        productName: appletInfo.product,
        coinType: localAppletVersion.installed ? localAppletVersion.coinType : ''
      })
    }
    return appletList
  }

  static _isNeedUpgrade (newVersion, oldVersion) {
    newVersion = newVersion.split('.').map(i => parseInt(i))
    oldVersion = oldVersion.split('.').map(i => parseInt(i))
    let size = Math.min(newVersion.length, oldVersion.length)

    for (let i = 0; i < size; i++) {
      if (newVersion[i] > oldVersion[i]) {
        return true
      }
    }
    return false
  }

  async installUpgrade (appletInfo, progressCallback) {
    progressCallback = progressCallback || (() => {})
    console.log('installUpgrade appletInfo', appletInfo)
    if (!appletInfo) {
      console.warn('installUpgrade appletInfo != null', appletInfo)
      throw D.error.invalidParams
    }
    if (appletInfo.installed && !appletInfo.upgradable) {
      console.warn('installUpgrade appletInfo no need to install', appletInfo)
      throw D.error.invalidParams
    }
    progressCallback(D.updateStatus.getScript, 0)
    let walletInfo = await this._device.getWalletInfo()
    let localApplets = walletInfo.applet_versions
    let applets = []
    localApplets.map(it => applets.push(it.name))
    applets = applets.filter(it => it !== 'Common' && it !== 'Method')
    console.debug('local applets', applets)
    // get script
    let args = {
      'pro': appletInfo.productName,
      'applets': applets
    }
    console.debug('get scripts', args)
    let response = await D.http.post(server + 'script/' + appletInfo.name + '/' + appletInfo.latestVersion, JSON.stringify(args), 'application/json')
    let script = response.script
    console.debug(JSON.stringify(script))

    progressCallback(D.updateStatus.handleData, 10)

    if (appletInfo.installed) {
      // release
      if (appletInfo.name !== 'Backup' && appletInfo.name !== 'Common' && appletInfo.name !== 'Method') {
        console.debug(appletInfo.name + ' exec release cmd')
        await this._device.sendApdu('8002000000', true, appletInfo.coinType)
      }
      // delete
      // await this._externalAuthenticate()
      // await this._device.sendApdu('80E400800A4F08B000000000' + appletInfo.packageId, true)
    }

    progressCallback(D.updateStatus.install, 15)
    // install
    // await this._externalAuthenticate()
    let count = 0
    for (let apdu of script) {
      progressCallback(D.updateStatus.install, 15 + Math.floor(60 * count / script.length))
      try {
        await this._device.sendApdu(apdu, true)
      } catch (e) {
        // if you delete an applet that is not installed, you will get D.error.referenceNotFound error.
        // ignore it.
        if (e !== D.error.referenceNotFound) {
          throw e
        }
      }
      count++
    }
    progressCallback(D.updateStatus.init, 90)
    progressCallback(D.updateStatus.initFinish, 100)
  }

  async _externalAuthenticate () {
    // default test key
    const senc = '404142434445464748494a4b4c4d4e4f'
    const smac = '404142434445464748494a4b4c4d4e4f'
    const iv = '0000000000000000'

    await this._device.sendApdu('00A4040008A000000003000000')
    let random = D.getRandomHex(16)
    let randomResponse = await this._device.sendApdu('8050000008' + random)
    randomResponse = randomResponse.toString('hex')

    let sequenceCounter = randomResponse.slice(24, 28)
    let cardRandData = randomResponse.slice(28, 40)

    let derivationDataCMac = '0101' + sequenceCounter + '000000000000000000000000'
    let derivationDataSEnc = '0182' + sequenceCounter + '000000000000000000000000'

    let cMacSKey = await this._des112CbcEnc(smac, iv, derivationDataCMac)
    cMacSKey = cMacSKey.toString('hex')
    console.info('_externalAuthenticate cMacSKey', cMacSKey, smac, iv, derivationDataCMac)
    let sEncSKey = await this._des112CbcEnc(senc, iv, derivationDataSEnc)
    sEncSKey = sEncSKey.toString('hex')
    console.info('_externalAuthenticate sEncSKey', sEncSKey, senc, iv, derivationDataSEnc)

    let cardCrypto = await this._des112CbcEnc(sEncSKey, iv, sequenceCounter + cardRandData + random + '8000000000000000')
    cardCrypto = cardCrypto.toString('hex')
    console.info('_externalAuthenticate cardCrypto', cardCrypto, sEncSKey, sequenceCounter + cardRandData + random + '8000000000000000')

    let mac = await this._des112Mac(cMacSKey, iv, '8482000010' + cardCrypto.slice(32, 48))
    mac = mac.toString('hex')
    console.info('mac', mac, '8482000010' + cardCrypto.slice(32, 48))

    let apdu = '8482000010' + cardCrypto.slice(32, 48) + mac
    console.info('_externalAuthenticate apdu', apdu)
    await this._device.sendApdu(apdu)
    console.log('_externalAuthenticate finish')
  }

  async _des112CbcEnc (key, iv, data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'hex')
    }
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    if (typeof iv === 'string') {
      iv = Buffer.from(iv, 'hex')
    }

    let des168Key = Buffer.concat([key, key.slice(0, 8)]) // des112 => des 168
    let input = CryptoJS.lib.WordArray.create(data)
    let pass = CryptoJS.lib.WordArray.create(des168Key)
    let ivData = CryptoJS.lib.WordArray.create(iv)
    let encData = CryptoJS.TripleDES.encrypt(input, pass, {
      mode: CryptoJS.mode.CBC,
      iv: ivData,
      padding: CryptoJS.pad.NoPadding
    })
    return Buffer.from(encData.ciphertext.toString(CryptoJS.enc.Hex), 'hex')
  }

  async _des112Mac (key, iv, data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'hex')
    }
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    if (typeof iv === 'string') {
      iv = Buffer.from(iv, 'hex')
    }
    const ivLength = 8
    iv = Buffer.allocUnsafe(32).copy(iv)

    let remainLength = data.length % ivLength
    let blockDataLen = data.length - remainLength
    if (blockDataLen > 0) {
      let des56Key = key.slice(0, 8) // des112 => des 56
      let input = CryptoJS.lib.WordArray.create(data.slice(0, blockDataLen))
      let pass = CryptoJS.lib.WordArray.create(des56Key)
      let ivData = CryptoJS.lib.WordArray.create(iv)
      let encData = CryptoJS.DES.encrypt(input, pass, {
        mode: CryptoJS.mode.CBC,
        iv: ivData,
        padding: CryptoJS.pad.NoPadding
      })
      encData = Buffer.from(encData.ciphertext.toString(CryptoJS.enc.Hex), 'hex')
      iv = encData.slice(blockDataLen - ivLength, blockDataLen)
    }
    for (let i = 0; i < remainLength; i++) {
      iv[i] ^= data[blockDataLen + i]
    }
    iv[remainLength] ^= 0x80
    return Crypto.des112(true, iv, key)
  }
}
