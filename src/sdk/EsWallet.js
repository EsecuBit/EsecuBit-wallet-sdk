
import D from './D'
import CoinData from './data/CoinData'
import BtcAccount from './account/BtcAccount'
import EthAccount from './account/EthAccount'
import EosAccount from './account/EosAccount'
import Settings from './Settings'
import CoreWallet from './device/CoreWallet'

/**
 * Main entry of SDK, singleton. Object to manage wallet operation and wallet data.
 */
export default class EsWallet {
  /**
   * Get supported coin types.
   *
   * @returns String array
   */
  static supportedCoinTypes () {
    return D.supportedCoinTypes()
  }

  /**
   * Get supported legal currency types.
   *
   * @returns String array
   */
  static suppertedLegals () {
    return D.suppertedLegals()
  }

  /**
   * Will init fields and listen device plugin.
   *
   * @returns {EsWallet|*}
   */
  constructor () {
    if (EsWallet.prototype.Instance) {
      return EsWallet.prototype.Instance
    }
    EsWallet.prototype.Instance = this

    this._settings = new Settings()
    this._info = {}
    this._esAccounts = []
    this._coinData = new CoinData()
    this._status = D.status.plugOut
    this._callback = null

    this._device = new CoreWallet()
    this._device.listenPlug(async (error, plugStatus) => {
      // ignore the same plug event sent multiple times
      if (this._status !== D.status.plugOut) {
        if (plugStatus === D.status.plugIn) {
          return
        }
      }

      // handle error
      this._status = plugStatus
      if (error !== D.error.succeed) {
        this._callback && D.dispatch(() => this._callback(error, this._status))
        return
      }

      // send plug status
      this._callback && D.dispatch(() => this._callback(D.error.succeed, this._status))
      if (this._status === D.status.plugIn) {
        this.offlineMode = false

        // initializing
        this._status = D.status.initializing
        this._callback && D.dispatch(() => this._callback(D.error.succeed, this._status))
        try {
          let newInfo = await this._init()
          if (this._info.walletId !== newInfo.walletId) {
            this._callback && D.dispatch(() => this._callback(D.error.succeed, D.status.deviceChange))
          }
          this._info = newInfo
        } catch (e) {
          console.warn(e)
          this._callback && D.dispatch(() => this._callback(e, this._status))
          return
        }
        if (this._status === D.status.plugOut) return

        // syncing
        this._status = D.status.syncing
        this._callback && D.dispatch(() => this._callback(D.error.succeed, this._status))
        try {
          await this._sync()
        } catch (e) {
          console.warn(e)
          this._callback && D.dispatch(() => this._callback(e, this._status))
          return
        }
        if (this._status === D.status.plugOut) return

        // syncFinish
        this._status = D.status.syncFinish
        this._callback && D.dispatch(() => this._callback(D.error.succeed, this._status))
      } else if (this._status === D.status.plugOut) {
        this.offlineMode = true
        this._release()
      }
    })
  }

  /**
   * Use wallet in offline mode, do not have to connect the key and network
   */
  async enterOfflineMode () {
    if (this._status !== D.status.plugOut) throw D.error.offlineModeUnnecessary
    this.offlineMode = true
    this._info = await this._init()
    await this._sync()
  }

  /**
   * Init device and data. Invoke inside when detect device plugin or called enterOfflineMode().
   *
   * @returns {Promise<{walletId: String}|*>}
   * @private
   */
  async _init () {
    this._esAccounts = []

    let info
    if (!this.offlineMode) {
      info = await this._device.init()
      await this._settings.setSetting('lastWalletId', info.walletId)
    } else {
      let lastWalletId = await this._settings.getSetting('lastWalletId')
      if (!lastWalletId) {
        // noinspection ExceptionCaughtLocallyJS
        throw D.error.offlineModeNotAllowed
      }
      info = {walletId: lastWalletId}
    }

    await this._coinData.init(info, this.offlineMode)
    let accounts = await this._coinData.getAccounts()
    accounts = accounts.filter(account => EsWallet.supportedCoinTypes().includes(account.coinType))
    accounts.forEach(account => {
      let exists = this._esAccounts.some(esAccount => esAccount.accountId === account.accountId)
      if (exists) return

      let coinType = account.coinType
      let esAccount
      if (D.isBtc(coinType)) {
        esAccount = new BtcAccount(account, this._device, this._coinData)
      } else if (D.isEth(coinType)) {
        esAccount = new EthAccount(account, this._device, this._coinData)
      } else if (D.isEos(coinType)) {
        esAccount = new EosAccount(account, this._device, this._coinData)
      } else {
        console.warn('EsWallet don\'t support this coinType', coinType)
        throw D.error.coinNotSupported
      }
      this._esAccounts.push(esAccount)
    })
    await Promise.all(this._esAccounts.map(esAccount => esAccount.init()))

    return info
  }

  /**
   * Synchronize data from device and network. Invoke inside when detect device plugin or called enterOfflineMode().
   *
   * @private
   */
  async _sync () {
    await this._coinData.sync()
    await Promise.all(this._esAccounts.map(esAccount => esAccount.sync(true, this.offlineMode)))

    let recoveryFinish = await this._settings.getSetting('recoveryFinish', this._info.walletId)
    if (!recoveryFinish || this._esAccounts.length === 0) {
      if (this.offlineMode) throw D.error.offlineModeNotAllowed
      console.log('start recovery', recoveryFinish, this._esAccounts.length)
      try {
        // make sure no empty account before recover
        // if last recovery is stopped unexcepted, we will have part of accounts
        for (let esAccount of this._esAccounts) {
          if ((await esAccount.getTxInfos()).total === 0) {
            console.warn(esAccount.accountId, 'has no txInfo before recovery, delete it')
            this._esAccounts = this._esAccounts.filter(a => a !== esAccount)
            await esAccount.delete()
          }
        }

        // Here we can't use Promise.all() in recover, because data may be invalid when one
        // of account occur errors, while other type of account is still running recover.
        // In this case, deleting all account may failed because account which is still running
        // may writing account data into database later. We don't have mechanism to make them stop.
        for (let coinType of D.recoverCoinTypes()) {
          await this._recover(coinType)
        }
        await this._settings.setSetting('recoveryFinish', true, this._info.walletId)
      } catch (e) {
        console.warn('recover error', e)
        console.warn('recover account failed, recoveryFinish = false, wait for recover next time', this._esAccounts)
        this._esAccounts = []
        throw e
      }
    }
  }

  /**
   * Recover accounts for specific coinType. Invoke inside when detect device plugin or called enterOfflineMode()
   * and found no accounts for this coinType.
   *
   * @param coinType
   * @private
   */
  async _recover (coinType) {
    while (true) {
      let account = await this._coinData.newAccount(coinType)
      let esAccount
      if (D.isBtc(coinType)) {
        esAccount = new BtcAccount(account, this._device, this._coinData)
      } else if (D.isEth(coinType)) {
        esAccount = new EthAccount(account, this._device, this._coinData)
      } else if (D.isEos(coinType)) {
        esAccount = new EosAccount(account, this._device, this._coinData)
      } else {
        console.warn('EsWallet don\'t support this coinType', coinType)
        throw D.error.coinNotSupported
      }
      this._esAccounts.push(esAccount)

      await esAccount.init()
      await esAccount.sync(true)

      // new account has no transactions, recover finish
      if ((await esAccount.getTxInfos()).total === 0) {
        if (esAccount.index !== 0) {
          console.log(esAccount.accountId, 'has no txInfo, will not recover, delete it')
          this._esAccounts = this._esAccounts.filter(a => a !== esAccount)
          await esAccount.delete()
        } else {
          console.log(esAccount.accountId, 'has no txInfo, but it is the first account, keep it')
        }
        break
      }
    }
  }

  /**
   * Clear accounts and coinData status in memory. Invoke inside when detect device plugout.
   *
   * @private
   */
  async _release () {
    this._esAccounts = []
    await this._coinData.release()
  }

  /**
   * Clear all data in database. Used for unrecoverable error. Need resync after reset.
   *
   * @private
   */
  async reset () {
    await this._coinData.clearData()
  }

  /**
   * Listen wallet status.
   *
   * @param callback Function (errorCode, status) for listen wallet status.
   * @see D.status
   */
  listenStatus (callback) {
    this._callback = callback
    switch (this._status) {
      case D.status.plugIn:
        D.dispatch(() => callback(D.error.succeed, D.status.plugIn))
        break
      case D.status.initializing:
        D.dispatch(() => callback(D.error.succeed, D.status.plugIn))
        D.dispatch(() => callback(D.error.succeed, D.status.initializing))
        break
      case D.status.syncing:
        D.dispatch(() => callback(D.error.succeed, D.status.plugIn))
        D.dispatch(() => callback(D.error.succeed, D.status.initializing))
        D.dispatch(() => callback(D.error.succeed, D.status.syncing))
        break
      case D.status.syncFinish:
        D.dispatch(() => callback(D.error.succeed, D.status.plugIn))
        D.dispatch(() => callback(D.error.succeed, D.status.initializing))
        D.dispatch(() => callback(D.error.succeed, D.status.syncing))
        D.dispatch(() => callback(D.error.succeed, D.status.syncFinish))
        break
      case D.status.plugOut:
      default:
    }
  }

  /**
   * Callback when new transaction detect or old transaction status update
   *
   * @param callback Function(errorCode, txInfo)
   */
  listenTxInfo (callback) {
    this._coinData.addListener(callback)
  }

  /**
   * Get accounts in database that matches the filter.
   *
   * @param filter (optional)
   * {
   *   accountId: string
   * }
   * @returns {Promise<IAccount array>}
   */
  async getAccounts (filter) {
    const order = {}
    order[D.coin.main.btc] = 0
    order[D.coin.main.eth] = 1
    order[D.coin.test.btcTestNet3] = 100
    order[D.coin.test.ethRinkeby] = 101
    order[D.coin.test.ethRopsten] = 102
    return this._esAccounts.sort((a, b) => order[a.coinType] - order[b.coinType])
  }

  /**
   * New an account for specific coinType. Throw exception if not in availableNewAccountCoinTypes() list.
   *
   * @param coinType
   * @returns {Promise<IAccount>}
   */
  async newAccount (coinType) {
    let account = await this._coinData.newAccount(coinType)
    let esAccount
    if (D.isBtc(coinType)) {
      esAccount = new BtcAccount(account, this._device, this._coinData)
    } else if (D.isEth(coinType)) {
      esAccount = new EthAccount(account, this._device, this._coinData)
    } else if (D.isEos(coinType)) {
      esAccount = new EosAccount(account, this._device, this._coinData)
    } else {
      console.warn('EsWallet don\'t support this coinType', coinType)
      throw D.error.coinNotSupported
    }
    await esAccount.init()
    await esAccount.sync()
    this._esAccounts.push(esAccount)
    return esAccount
  }

  /**
   * Returns coinTypes that match BIP44 account discovery limit to generate a new account
   * which needs last account has at least one transactions.
   *
   * @returns {Promise<Array>}
   */
  async availableNewAccountCoinTypes () {
    let availables = []
    for (let coinType of D.supportedCoinTypes()) {
      if ((await this._coinData._newAccountIndex(coinType)) >= 0) {
        availables.push(coinType)
      }
    }
    return availables
  }

  /**
   * Returns wellet version info.
   *
   * @returns {Promise<Object>}
   */
  getWalletInfo () {
    return this._device.getWalletInfo()
  }

  /**
   * Returns network providers info that using in this SDK. Thanks for their helps.
   *
   * @returns {Promise<Object>}
   */
  getProviders () {
    return this._coinData.getProviders()
  }

  /**
   *
   * Convert value between coin value and legal currency value. The data comes from the Internet
   * and refresh every 30 mins (2018/11/2) in background.
   * Throw error when fromUint and toUint are both legals or coins (2018/11/2).
   *
   * @param coinType
   * @param value
   * @param fromUnit unit defined in D.unit
   * @param toUnit unit defined in D.unit
   * @returns string Decimal string value
   *
   * @see D.unit
   */
  convertValue (coinType, value, fromUnit, toUnit) {
    return this._coinData.convertValue(coinType, value, fromUnit, toUnit)
  }

  /**
   * Get the wallet seed for JavaScript wallet. No security guaranteed.
   *
   * @returns {Promise<String>}
   */
  getTestSeed () {
    return new Settings().getTestSeed()
  }

  /**
   * Set the wallet seed for JavaScript wallet. No security guaranteed.
   *
   * @param testSeed
   */
  setTestSeed (testSeed) {
    return new Settings().setTestSeed(testSeed)
  }
}
