
import D from './D'
import JsWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import CoinData from './data/CoinData'
import BtcAccount from './BtcAccount'
import EthAccount from './EthAccount'

export default class EsWallet {
  /**
   * get support coin types
   * @returns {*[]}
   */
  static supportedCoinTypes () {
    return D.suppertedCoinTypes()
  }

  static supportedLegalCurrency () {
    return D.suppertedLegals()
  }

  constructor () {
    if (EsWallet.prototype.Instance) {
      return EsWallet.prototype.Instance
    }
    EsWallet.prototype.Instance = this

    this._device = D.test.jsWallet ? new JsWallet() : new CoreWallet()
    this._coinData = new CoinData()
    this._status = D.status.plugOut
    this._callback = null
    this._device.listenPlug(async (error, plugStatus) => {
      this._status = plugStatus
      if (error !== D.error.succeed) {
        this._callback && this._callback(error, this._status)
        return
      }
      this._callback && this._callback(D.error.succeed, this._status)
      if (this._status === D.status.plugIn) {
        this._status = D.status.initializing
        this._callback && this._callback(D.error.succeed, this._status)
        try {
          await this._init()
        } catch (e) {
          this._callback && this._callback(e, this._status)
          return
        }
        if (this._status === D.status.plugOut) return

        this._status = D.status.syncing
        this._callback && this._callback(D.error.succeed, this._status)
        try {
          await this._sync()
        } catch (e) {
          this._callback && this._callback(e, this._status)
          return
        }
        if (this._status === D.status.plugOut) return

        this._status = D.status.syncFinish
        this._callback && this._callback(D.error.succeed, this._status)
      } else {
        this._release()
      }
    })
  }

  async _init () {
    let info = await this._device.init()
    await this._coinData.init(info)
    this._esAccounts = (await this._coinData.getAccounts()).map(account => {
      if (account.coinType === D.coin.main.eth || account.coinType === D.coin.test.ethRinkeby) {
        return new EthAccount(account, this._device, this._coinData)
      } else {
        return new BtcAccount(account, this._device, this._coinData)
      }
    })
    await Promise.all(this._esAccounts.map(esAccount => esAccount.init()))
  }

  // TODO some block may forked and became orphan in the future, some txs and utxos may be invalid
  async _sync () {
    await this._device.sync()

    if (this._esAccounts.length === 0) {
      console.log('no accounts, new wallet, start recovery')
      await Promise.all(D.recoverCoinTypes().map(coinType => this._recover(coinType)))
    } else {
      await Promise.all(this._esAccounts.map(esAccount => esAccount.sync()))
    }
  }

  async _recover (coinType) {
    while (true) {
      let account = await this._coinData.newAccount(coinType)
      let esAccount
      if (coinType.includes('btc')) {
        esAccount = new BtcAccount(account, this._device, this._coinData)
      } else if (coinType.includes('eth')) {
        esAccount = new EthAccount(account, this._device, this._coinData)
      } else {
        throw D.error.coinNotSupported
      }
      await esAccount.init()
      await esAccount.sync()
      // new account has no transactions, recover finish
      if ((await esAccount.getTxInfos()).total === 0) {
        if (esAccount.index !== 0) {
          console.log(esAccount.accountId, 'has no txInfo, will not recover, delete it')
          await esAccount.delete()
        } else {
          this._esAccounts.push(esAccount)
        }
        break
      }
      this._esAccounts.push(esAccount)
    }
  }

  _release () {
    return this._coinData.release()
  }

  listenStatus (callback) {
    this._callback = callback
    switch (this._status) {
      case D.status.plugIn:
        callback(D.error.succeed, D.status.plugIn)
        break
      case D.status.initializing:
        callback(D.error.succeed, D.status.plugIn)
        callback(D.error.succeed, D.status.initializing)
        break
      case D.status.syncing:
        callback(D.error.succeed, D.status.plugIn)
        callback(D.error.succeed, D.status.initializing)
        callback(D.error.succeed, D.status.syncing)
        break
      case D.status.syncFinish:
        callback(D.error.succeed, D.status.plugIn)
        callback(D.error.succeed, D.status.initializing)
        callback(D.error.succeed, D.status.syncing)
        callback(D.error.succeed, D.status.syncFinish)
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
    return this._esAccounts
  }

  async newAccount (coinType) {
    let account = await this._coinData.newAccount(coinType)
    let esAccount = new BtcAccount(account, this._device, this._coinData)
    await esAccount.init()
    this._esAccounts.push(esAccount)
    return esAccount
  }

  async availableNewAccountCoinTypes () {
    let availables = []
    for (let coinType of D.suppertedCoinTypes()) {
      if ((await this._coinData._newAccountIndex(coinType)) >= 0) {
        availables.push(coinType)
      }
    }
    return availables
  }

  getWalletInfo () {
    return this._device.getWalletInfo()
  }

  /**
   * convert coin value
   */
  convertValue (coinType, value, fromUnit, toUnit) {
    return this._coinData.convertValue(coinType, value, fromUnit, toUnit)
  }
}
