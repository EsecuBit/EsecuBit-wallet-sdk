
import D from './D'
import CoinData from './data/CoinData'
import BtcAccount from './account/BtcAccount'
import EthAccount from './account/EthAccount'
import EosAccount from './account/EosAccount'
import Settings from './Settings'
import CoreWallet from './device/CoreWallet'
import EthTokenList from './data/EthTokenList'

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

    this._syncBefore = false
    this.offlineMode = true
    this._settings = new Settings()
    this._info = {}
    this._esAccounts = []
    this._coinData = new CoinData()
    this._status = D.status.plugOut
    this._callback = () => {}

    this._device = new CoreWallet()
    this._device.listenPlug(async (error, plugStatus) => {
      // ignore the same plug event sent multiple times
      if (plugStatus === this._status) {
        return
      }
      console.log('new plug status', plugStatus, this._status)

      // handle error
      this._status = plugStatus
      if (error !== D.error.succeed) {
        this._dispatchError(error)
        return
      }

      D.dispatch(async () => {
        // send plug status
        this._dispatchCurrentStatus()
        if (this._status === D.status.plugIn) {
          this.offlineMode = false
          await this._handleInit(error, plugStatus)
        } else if (this._status === D.status.plugOut) {
          this.offlineMode = true
          await this._release()
        }
      })
    })

    // receving event when accounts is syncing
    this._syncCallback = (error, status, objects) => {
      // TODO implement
      console.warn('implement _syncCallback', error, status, objects)
    }
  }

  /**
   * Use wallet in offline mode, do not have to connect the key and network
   */
  async enterOfflineMode () {
    if (this._status !== D.status.plugOut) throw D.error.offlineModeUnnecessary
    // noinspection JSIgnoredPromiseFromCall
    this._handleInit()
  }

  async _handleInit () {
    while (this._initLock) await D.wait(10)
    this._initLock = true

    try {
      // initializing
      this._status = D.status.initializing
      this._dispatchCurrentStatus()
      let newInfo = await this._init()
      if (this._info.walletId && (this._info.walletId !== newInfo.walletId)) {
        this._syncBefore = false
        this._dispatchEvent(D.status.deviceChange)
      }
      this._info = newInfo
      if (this._status === D.status.plugOut) return

      // syncing
      this._status = D.status.syncing
      this._dispatchCurrentStatus()
      !this._syncBefore && await this._sync()
      if (this._status === D.status.plugOut) return
      this._syncBefore = true

      // syncFinish
      this._status = D.status.syncFinish
      this._dispatchCurrentStatus()
    } catch (e) {
      console.warn(e)
      this._dispatchError(e)
    } finally {
      this._initLock = false
    }
  }

  _dispatch (error, state, data) {
    D.dispatch(() => this._callback(error, state, data))
  }

  _dispatchError (error) {
    this._dispatch(error, this._status, {})
  }

  _dispatchCurrentStatus (data = {}) {
    this._dispatch(D.error.succeed, this._status, data)
  }

  _dispatchEvent (status, data = {}) {
    this._dispatch(D.error.succeed, status, data)
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
      info = await this._device.init((status, authCode) => {
        this._status = status
        if (status === D.status.auth) {
          console.log('show auth code', authCode)
        } else {
          console.log('auth finish')
        }
        this._dispatchCurrentStatus(authCode)
      })
      await this._settings.setSetting('lastWalletId', info.walletId)
    } else {
      let lastWalletId = await this._settings.getSetting('lastWalletId')
      if (!lastWalletId) {
        console.warn('offlineMode no device connected before')
        throw D.error.offlineModeNotAllowed
      }
      let recoveryFinish = await this._settings.getSetting('recoveryFinish', lastWalletId)
      if (!recoveryFinish) {
        console.warn('offlineMode last device not recovery finished', lastWalletId)
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
    await Promise.all(this._esAccounts.map(esAccount => esAccount.sync(this._syncCallback, true, this.offlineMode)))

    let recoveryFinish = await this._settings.getSetting('recoveryFinish', this._info.walletId)
    recoveryFinish = recoveryFinish || false

    let recoverCoinTypes
    if (!recoveryFinish || this._esAccounts.length === 0) {
      if (this.offlineMode) throw D.error.offlineModeNotAllowed
      recoverCoinTypes = D.recoverCoinTypes()
    } else {
      // if every accounts of a coinType has txs, checkout the next account in case next account
      // is generated and make transaction on other device
      // TODO LATER we are going to get these informations from device data(WalletData.js)
      for (let coinType of D.recoverCoinTypes()) {
        recoverCoinTypes = []
        let lastAccount = this._getLastAccount(coinType)
        if (!lastAccount || lastAccount.txInfos.length > 0) {
          recoverCoinTypes.push(coinType)
        }
      }
    }

    if (recoverCoinTypes.length > 0) {
      if (this.offlineMode) {
        console.warn('wallet needs discover new accounts but it\'s in offlineMode, wait for next time')
        return
      }
      console.log('start recovery', recoveryFinish, recoverCoinTypes, this._esAccounts.length)

      // In case when one of accounts occur error, while other accounts
      // is still running recover.
      // In this case, wait for all accounts stop before throw an error.
      let error = null
      await Promise.all(D.recoverCoinTypes().map(coinType =>
        this._recover(coinType).catch(e => {
          console.warn('recover error occured', e)
          error = e
        })))

      if (error) {
        console.warn('recover error', error)
        console.warn('recover account failed, recoveryFinish = false, wait for recover next time', this._esAccounts)
        this._esAccounts = []
        throw error
      }
      console.warn('recovery finish, set recoveryFinish true')
      await this._settings.setSetting('recoveryFinish', true, this._info.walletId)
    }

    // set account show status
    for (let esAccount of this._esAccounts) {
      if ((esAccount.status === D.account.status.hideByNoTxs && esAccount.txInfos.length !== 0) ||
        (esAccount.index === 0 && esAccount.status !== D.account.status.hideByUser)) {
        esAccount.status = D.account.status.show
        await this._coinData.updateAccount(esAccount._toAccountInfo())
      }
    }
  }

  /**
   * Recover accounts for specific coinType.
   *
   * @param coinType
   * @private
   */
  async _recover (coinType) {
    while (true) {
      let esAccount
      let lastAccount = this._getLastAccount(coinType)
      if (lastAccount && lastAccount.txInfos.length === 0) {
        esAccount = lastAccount
      } else {
        let account = await this._coinData.newAccount(coinType)
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

        this._dispatchEvent(D.status.syncingNewAccount, esAccount)
        await esAccount.init()
        this._esAccounts.push(esAccount)
      }

      await esAccount.sync(this._syncCallback, true)
      // new account has no transactions, recover finish
      if (esAccount.txInfos.length === 0) {
        console.log(esAccount.accountId, 'has no txInfo, stop')
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
    await this._coinData.release()
  }

  /**
   * Clear all data in database. Used for unrecoverable error. Need resync after reset.
   *
   * @private
   */
  async reset () {
    this._syncBefore = false
    await this._coinData.clearData()
  }

  /**
   * Listen wallet status.
   *
   * @param callback Function (errorCode, status) for listen wallet status.
   * @see D.status
   */
  listenStatus (callback) {
    this._callback = callback || (() => {})

    if (!this.offlineMode) {
      this._dispatchEvent(D.status.plugIn)
    }

    switch (this._status) {
      case D.status.plugIn:
        break
      case D.status.initializing:
        this._dispatchEvent(D.status.initializing)
        break
      case D.status.syncing:
        this._dispatchEvent(D.status.initializing)
        this._dispatchEvent(D.status.syncing)
        break
      case D.status.syncFinish:
        this._dispatchEvent(D.status.initializing)
        this._dispatchEvent(D.status.syncing)
        this._dispatchEvent(D.status.syncFinish)
        break
      case D.status.plugOut:
      default:
        break
    }
  }

  /**
   * Callback when new transaction detect or old transaction status update
   *
   * @param callback Function(errorCode, txInfo)
   */
  listenTxInfo (callback) {
    this._coinData.setListner(callback)
  }

  /**
   * Get accounts in database that matches the filter.
   *
   * @param filter (optional)
   * {
   *   accountId: string,
   *   coinType: string,
   *   showAll: bool // only return hide accounts if false
   * }
   * @returns {Promise<IAccount[]>}
   */
  async getAccounts (filter = {}) {
    const order = {}
    let index = 0
    for (let coinType of Object.values(D.coin.main)) {
      order[coinType] = index++
    }
    for (let coinType of Object.values(D.coin.test)) {
      order[coinType] = index++
    }

    let accounts = this._esAccounts
      .filter(a => a.status !== D.account.status.hideByNoTxs)
      .sort((a, b) => {
        let coinOrder = order[a.coinType] - order[b.coinType]
        if (coinOrder !== 0) return coinOrder
        return b.index - a.index
      })

    if (!filter.showAll) {
      accounts = accounts.filter(a => a.status === D.account.status.show)
    }
    if (filter.coinType) {
      accounts = accounts.filter(a => a.coinType === filter.coinType)
    }
    if (filter.accountId) {
      accounts = accounts.filter(a => a.accountId === filter.accountId)
    }

    return accounts
  }

  /**
   * New an account for specific coinType. Throw exception if not in availableNewAccountCoinTypes() list.
   *
   * @param coinType
   * @returns {Promise<IAccount>}
   */
  async newAccount (coinType) {
    let lastAccount = this._getLastAccount(coinType)
    if (lastAccount.status === D.account.status.hideByNoTxs) {
      lastAccount.status = D.account.status.show
      await this._coinData.updateAccount(lastAccount)
      return lastAccount
    }

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

  _getLastAccount (coinType) {
    let lastAccount = this._esAccounts
      .filter(account => account.coinType === coinType)
      .reduce((lastAccount, account) =>
        lastAccount.index > account.index ? lastAccount : account, {txInfos: [], index: -1})
    if (lastAccount.index === -1) lastAccount = null
    return lastAccount
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
      let lastAccount = this._getLastAccount(coinType)
      if (lastAccount.status === D.account.status.hideByNoTxs) {
        availables.push(coinType)
      } else if ((await this._coinData._newAccountIndex(coinType)) >= 0) {
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

  getDeviceBattery () {
    return this._device.getWalletBattery()
  }

  /**
   * Get known ETH token list.
   *
   * @returns {Promise<Object>}
   */
  async getEthTokenList () {
    return EthTokenList
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
