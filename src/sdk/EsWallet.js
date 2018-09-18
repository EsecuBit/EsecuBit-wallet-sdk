
import D from './D'
import CoinData from './data/CoinData'
import BtcAccount from './BtcAccount'
import EthAccount from './EthAccount'
import Provider from './Provider'

export default class EsWallet {
  /**
   * get supported coin types
   */
  static supportedCoinTypes () {
    return D.supportedCoinTypes()
  }

  /**
   * get supported legal currency types
   */
  static suppertedLegals () {
    return D.suppertedLegals()
  }

  constructor () {
    if (EsWallet.prototype.Instance) {
      return EsWallet.prototype.Instance
    }
    EsWallet.prototype.Instance = this

    this._info = {}
    this._esAccounts = []
    this._coinData = new CoinData()
    this._status = D.status.plugOut
    this._callback = null

    this._device = new Provider.Wallet()
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
   * use wallet in offline mode, do not have to connect the key and network
   */
  async enterOfflineMode () {
    if (this._status !== D.status.plugOut) throw D.error.offlineModeUnnecessary
    this.offlineMode = true
    this._info = await this._init()
    await this._sync()
  }

  async _init () {
    this._esAccounts = []
    let info
    if (!this.offlineMode) {
      info = await this._device.init()
    }

    let newInfo = await this._coinData.init(info, this.offlineMode)
    let accounts = await this._coinData.getAccounts()
    accounts = accounts.filter(account => EsWallet.supportedCoinTypes().includes(account.coinType))
    accounts.forEach(account => {
      let exists = this._esAccounts.some(esAccount => esAccount.accountId === account.accountId)
      if (exists) return
      let esAccount = D.isEth(account.coinType)
        ? new EthAccount(account, this._device, this._coinData)
        : new BtcAccount(account, this._device, this._coinData)
      this._esAccounts.push(esAccount)
    })
    await Promise.all(this._esAccounts.map(esAccount => esAccount.init()))

    return newInfo
  }

  async _sync () {
    if (this._esAccounts.length === 0) {
      if (this.offlineMode) throw D.error.offlineModeNotAllowed
      console.log('no accounts, new wallet, start recovery')
      try {
        // Here we can't use Promise.all() in recover, because data may be invalid when one
        // of account occur errors, while other type of account is still running recover.
        // In this case, deleting all account may failed because account which is still running
        // may writing account data into database later. We don't have mechanism to make them stop.
        for (let coinType of D.recoverCoinTypes()) {
          await this._recover(coinType)
        }
      } catch (e) {
        console.warn('recover error', e)
        console.warn('recover account failed, deleting all accounts', this._esAccounts)
        for (let esAccount of this._esAccounts) {
          await esAccount.delete()
        }
        this._esAccounts = []
        throw e
      }
    } else {
      await Promise.all(this._esAccounts.map(esAccount => esAccount.sync(true, this.offlineMode)))
    }
  }

  async _recover (coinType) {
    while (true) {
      let account = await this._coinData.newAccount(coinType)
      let esAccount
      if (D.isBtc(coinType)) {
        esAccount = new BtcAccount(account, this._device, this._coinData)
      } else if (D.isEth(coinType)) {
        esAccount = new EthAccount(account, this._device, this._coinData)
      } else {
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

  _release () {
    this._esAccounts = []
    return this._coinData.release()
  }

  /**
   * Clear all data. Used for unrecoverable error. Need resync after reset.
   */
  reset () {
    return this._coinData.clearData()
  }

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
   * callback when new transaction detect or old transaction status update
   */
  listenTxInfo (callback) {
    this._coinData.addListener(callback)
  }

  /**
   * get accounts in database matches the filter
   *
   * @param filter (optional)
   * {
   *   accountId: string
   * }
   * @returns {Promise<*>}
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

  async newAccount (coinType) {
    let account = await this._coinData.newAccount(coinType)
    let esAccount = D.isBtc(coinType)
      ? new BtcAccount(account, this._device, this._coinData)
      : new EthAccount(account, this._device, this._coinData)
    await esAccount.init()
    await esAccount.sync()
    this._esAccounts.push(esAccount)
    return esAccount
  }

  async availableNewAccountCoinTypes () {
    let availables = []
    for (let coinType of D.supportedCoinTypes()) {
      if ((await this._coinData._newAccountIndex(coinType)) >= 0) {
        availables.push(coinType)
      }
    }
    return availables
  }

  getWalletInfo () {
    return this._device.getWalletInfo()
  }

  getProviders () {
    return this._coinData.getProviders()
  }

  /**
   * convert coin value
   */
  convertValue (coinType, value, fromUnit, toUnit) {
    return this._coinData.convertValue(coinType, value, fromUnit, toUnit)
  }
}
