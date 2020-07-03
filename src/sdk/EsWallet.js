
import D from './D'
import CoinData from './data/CoinData'
import BtcAccount from './account/BtcAccount'
import EthAccount from './account/EthAccount'
import EosAccount from './account/EosAccount'
import Settings from './Settings'
import CoreWallet from './device/CoreWallet'
import EthTokenList from './data/EthTokenList'
import UpdateManager from './device/update/UpgradeManager'
import BigInteger from 'bigi'

/**
 * Main entry of SDK, singleton. Object to manage wallet operation and wallet data.
 */
export default class EsWallet {
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

    this._autoSync = true
    this._syncBefore = false
    this._offlineMode = true
    this._settings = new Settings()
    this._info = {}
    this._esAccounts = []
    this._coinData = new CoinData()
    this._status = D.status.plugOut
    this._callback = () => {}

    this._device = new CoreWallet()
    this._deviceListener = async (error, plugStatus) => {
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
          this._offlineMode = false
          await this._initAndSyncWallet(error, plugStatus)
        } else if (this._status === D.status.plugOut) {
          this._offlineMode = true
          await this._release()
        }
      })
    }

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
    this._initAndSyncWallet()
  }

  async _initAndSyncWallet () {
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
      if (!this._offlineMode && !this._autoSync) {
        return
      }
      this._status = D.status.syncing
      this._dispatchCurrentStatus()
      !this._syncBefore && await this.sync()
      if (this._status === D.status.plugOut) return
      this._syncBefore = true

      // syncFinish
      this._status = D.status.syncFinish
      this._dispatchCurrentStatus()
      // get version async
      // this.getWalletInfo().then(() => console.log('async get wallet info finished'))
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
    let info = await this._initData()
    this._esAccounts = await this._initAccount()
    await this._initCoinTypes()
    return info
  }

  async _initData () {
    let info = {}

    let initNetWork = async () => {
      await this._coinData.initNetWork()
    }

    let initDb = async () => {
      if (!this._offlineMode) {
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
          console.warn('_offlineMode no device connected before')
          throw D.error.offlineModeNotAllowed
        }
        let recoveryFinish = await this._settings.getSetting('recoveryFinish', lastWalletId)
        if (!recoveryFinish) {
          console.warn('_offlineMode last device not recovery finished', lastWalletId)
          throw D.error.offlineModeNotAllowed
        }
        info = {walletId: lastWalletId}
      }
      await this._coinData.init(info, this._offlineMode)
    }

    await Promise.all([initNetWork(), initDb()])
    return info
  }

  async _initAccount () {
    let esAccounts = []
    let accounts = await this._coinData.getAccounts()
    let supportedCoinTypes = await this.supportedCoinTypes()
    accounts = accounts.filter(account => supportedCoinTypes.includes(account.coinType))
    accounts.forEach(account => {
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
      esAccounts.push(esAccount)
    })
    await Promise.all(esAccounts.map(esAccount => esAccount.init()))
    return esAccounts
  }

  /**
   * init the supported coin types for the wallet
   * @returns {Promise<void>}
   * @private
   */
  async _initCoinTypes () {
    if (this._device.getWalletName() === D.wallet.s300) {
      // if walletId is fill with zero, it means applet has skipped to create wallet and it only support eos
      if (!isNaN(Number(this._info.walletId))) {
        D.supportedCoinTypes = () => {
          return D.test.coin ? [D.coin.test.eosJungle] : [D.coin.main.eos]
        }
        D.recoverCoinTypes = () => {
          return D.test.coin ? [D.coin.test.eosJungle] : [D.coin.main.eos]
        }
      } else {
        D.supportedCoinTypes = () => D.backupCoinTypes()
        D.recoverCoinTypes = () => D.backupCoinTypes()
      }
    } else if (this._device.getWalletName() === D.wallet.netbank) {
      // netbank wallet only support btc and eth , it won't be update no longer
      D.supportedCoinTypes = () => {
        return D.test.coin ? [D.coin.test.btcTestNet3, D.coin.test.ethRinkeby] : [D.coin.main.btc, D.coin.main.eth]
      }
    }
    await this._settings.setSetting('supportedCoinTypes', D.supportedCoinTypes())
  }

  /**
   * Get supported coin types.
   *
   * @returns String array
   */
  async supportedCoinTypes () {
    let coinTypes = await this._settings.getSetting('supportedCoinTypes')
    if (!coinTypes) {
      return D.supportedCoinTypes()
    }
    return coinTypes
  }

  /**
   * Get supported legal currency types.
   *
   * @returns String array
   */
  suppertedLegals () {
    return D.suppertedLegals()
  }

  /**
   * Synchronize data from device and network. Invoke inside when detect device plugin or called enterOfflineMode().
   *
   * @private
   */
  async sync () {
    // if syning data costs too much time. the hardware will be power off in two minture and syning will be failed
    // so we send heart packet to avoid the hardware power off
    let syncHeartPacket = setInterval(async () => {
      try {
        console.info('sync heart packet')
        await this.getCosVersion()
      } catch (e) {
        console.warn('send heart packet: get cos version error', e)
      }
    }, 1000 * 90)

    await this._coinData.sync()
    await Promise.all(this._esAccounts.map(esAccount => esAccount.sync(this._syncCallback, true, this._offlineMode)))

    let recoveryFinish = await this._settings.getSetting('recoveryFinish', this._info.walletId)
    recoveryFinish = recoveryFinish || false

    let recoverCoinTypes
    if (!recoveryFinish || this._esAccounts.length === 0) {
      if (this._offlineMode) throw D.error.offlineModeNotAllowed
      recoverCoinTypes = D.recoverCoinTypes()
      if (recoverCoinTypes.findIndex(it => D.isEos(it)) !== -1) {
        this._deleteEosAccount()
        console.log('delete old eos account finish')
      }
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
      if (this._offlineMode) {
        console.warn('wallet needs discover new accounts but it\'s in _offlineMode, wait for next time')
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
      console.log('recovery finish, set recoveryFinish true')
      await this._settings.setSetting('recoveryFinish', true, this._info.walletId)
      // // TODO:
      // if (D.supportedCoinTypes().findIndex(it => D.isEos(it)) !== -1) {
      //   console.log('find the duplicate eos account')
      //   let accounts = await this._initAccount()
      //   let eosAccounts = accounts.filter(it => D.isEos(it.coinType))
      //   let duplicates = new Set()
      //   // find the duplicate eos account
      //   eosAccounts.reduce((prev, current) => {
      //     prev.map(it => {
      //       if(it.label === current.label) {
      //         duplicates.add(current)
      //       }
      //     })
      //     prev.push(current)
      //     return prev
      //   }, [])
      //   console.log('had find the duplicate eos account', duplicates)
      //   // delete the duplicate eos account
      //   for (let account of duplicates) {
      //     await this._coinData.deleteAccount(account)
      //   }
      // }
    }

    // set account show status
    for (let esAccount of this._esAccounts) {
      if ((esAccount.status === D.account.status.hideByNoTxs && esAccount.txInfos.length !== 0) ||
        (esAccount.index === 0 && esAccount.status !== D.account.status.hideByUser)) {
        esAccount.status = D.account.status.show
        await this._coinData.updateAccount(esAccount._toAccountInfo())
      }
    }

    syncHeartPacket && clearInterval(syncHeartPacket)
  }

  async _deleteEosAccount() {
    let accounts = await this._initAccount()
    let eosAccounts = accounts.filter(it => D.isEos(it.coinType))
    console.log('ready to delete eos account', JSON.stringify(eosAccounts))
    for (let account of eosAccounts) {
      console.log('delete eos account', account)
      await this._coinData.deleteAccount(account)
    }
  }

  /**
   * Recover accounts for specific coinType.
   *
   * @param coinType
   * @private
   */
  async _recover (coinType) {
    let accountsAmount = 0
    let permissions = []
    if (D.isEos(coinType) && !this._isHadGetPermissions) {
      permissions = await this._getEosAccountsAmountFromHardware(coinType)
      accountsAmount = permissions.length
      this._isHadGetPermissions = true
      console.log(accountsAmount + ' eos account wait for sync', permissions)
    }
    let accountIndex = 0
    while (true) {
      let esAccount
      let lastAccount = this._getLastAccount(coinType)
      if (!D.isEos(coinType) && lastAccount && lastAccount.txInfos.length === 0) {
        esAccount = lastAccount
      } else {
        let account = await this._coinData.newAccount(coinType, permissions[accountIndex])
        if (D.isBtc(coinType)) {
          esAccount = new BtcAccount(account, this._device, this._coinData)
        } else if (D.isEth(coinType)) {
          esAccount = new EthAccount(account, this._device, this._coinData)
        } else if (D.isEos(coinType)) {
          console.log('new eos account', accountIndex)
          esAccount = new EosAccount(account, this._device, this._coinData)
          ++accountIndex
        } else {
          console.warn('EsWallet don\'t support this coinType', coinType)
          throw D.error.coinNotSupported
        }
        this._dispatchEvent(D.status.syncingNewAccount, esAccount)
        await esAccount.init()
        this._esAccounts.push(esAccount)
      }
      await esAccount.sync(this._syncCallback, true)
      // new account has no transactions, recover finish (for btc, eth)
      if (!D.isEos(coinType) && esAccount.txInfos.length === 0) {
        console.log(esAccount.accountId, 'has no txInfo, stop')
        break
      }
      if (D.isEos(coinType) && accountIndex >= accountsAmount) {
        console.log('eos account has recover finish, stop')
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
    this._isHadGetPermissions = false
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
    this._device.listenPlug(this._deviceListener)

    if (!this._offlineMode && (this._status !== D.status.plugOut)) {
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

    let accounts = await this._initAccount()
    accounts = accounts.filter(a => a.status !== D.account.status.hideByNoTxs)
    accounts.sort((a, b) => {
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
    console.log('newAccount', lastAccount)
    if (lastAccount.status === D.account.status.hideByNoTxs) {
      lastAccount.status = D.account.status.show
      await this._coinData.updateAccount(lastAccount)
      console.log('newAccount`', lastAccount)
      return lastAccount
    }

    let account = await this._coinData.newAccount(coinType)
    account.status = D.account.status.show
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
   * Returns wallet version info.
   *
   * @returns {Promise<Object>}
   */
  getWalletInfo () {
    return this._device.getWalletInfo()
  }

  /**
   * Return wallet id
   * @returns {*|Promise<Object>}
   */
  getWalletId () {
    return this._device.getWalletId()
  }


  getCosVersion() {
    return this._device.getCosVersion()
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

  setEosAmountLimit (amount) {
    let value = amount
    if (value.includes('.')) {
      let index = value.length - 1
      while (value[index] === '0') index--
      if (value[index] === '.') index--
      value = value.slice(0, index + 1)
    }
    let parts = value.split('.')
    let precision = (parts[1] && parts[1].length) || 0
    if (precision > 4) {
      console.warn('setEosAmountLimit precision should not greater than 4', amount)
      throw D.error.invalidParams
    }

    value = new BigInteger(value.replace('.', ''))
    value = value.multiply(new BigInteger((10 ** (4 - precision)).toString()))
    if (value.compareTo(BigInteger.fromHex('ffffffffffffffff')) > 0) {
      console.warn('setEosAmountLimit value overflow', amount)
      throw D.error.invalidParams
    }
    value = value.toString()
    return this._device.setAmountLimit(D.coin.main.eos, value)
  }

  async _getEosAccountsAmountFromHardware (coinType) {
    // accountIndex set to 0 currently
    let permissions = await this._device.getPermissions(coinType, 0)
    let hash = {}
    permissions = permissions.reduce((item, next) => {
      hash[next.actor] ? '' : hash[next.actor] = true && item.push(next)
      return item
    }, [])
    return permissions
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

  /**
   * whether auto sync after connecting a device, or you can call await sync() manually later
   * @param enabled
   */
  setAutoSyncEnabled (enabled) {
    this._autoSync = !!enabled
  }

  /**
   * Get device update manager
   */
  getUpdateManager () {
    return new UpdateManager(this._device)
  }
}
