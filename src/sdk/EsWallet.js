
import D from './D'
import JsWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import CoinData from './data/CoinData'
import EsAccount from './EsAccount'

// TODO surrounded with try catch
const AVAILABLE_COIN_TYPES = [D.TEST_MODE ? D.COIN_BIT_COIN : D.COIN_BIT_COIN_TEST]
export default class EsWallet {
  /**
   * get support coin types
   * @returns {*[]}
   */
  static availableCoinTypes () {
    return AVAILABLE_COIN_TYPES
  }

  /**
   * convert coin value
   */
  static convertValue (coinType, fee, fromType, toType) {
    return D.convertValue(coinType, fee, fromType, toType)
  }

  constructor () {
    console.info('constructor eswallet')
    if (EsWallet.prototype.Instance) {
      return EsWallet.prototype.Instance
    }
    EsWallet.prototype.Instance = this

    this._device = D.TEST_JS_WALLET ? new JsWallet() : new CoreWallet()
    this._coinData = new CoinData()
    this._status = D.STATUS_PLUG_OUT
    this._callback = null
    this._device.listenPlug(async (error, plugStatus) => {
      this._status = plugStatus
      if (error !== D.ERROR_NO_ERROR) {
        this._callback && this._callback(error, this._status)
        return
      }
      this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
      if (this._status === D.STATUS_PLUG_IN) {
        this._status = D.STATUS_INITIALIZING
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
        try {
          await this._init()
        } catch (e) {
          this._callback && this._callback(e, this._status)
        }
        if (this._status === D.STATUS_PLUG_OUT) return

        this._status = D.STATUS_SYNCING
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
        try {
          await this._sync()
        } catch (e) {
          this._callback && this._callback(e, this._status)
        }
        if (this._status === D.STATUS_PLUG_OUT) return

        this._status = D.STATUS_SYNC_FINISH
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
      } else {
        this._release()
      }
    })
  }

  async _init () {
    // TODO remove test
    setInterval(() => console.log(new Date().getTime()), 1000)

    let info = await this._device.init()
    await this._coinData.init(info)
    this._esAccounts = await this._coinData.getAccounts().map(account => new EsAccount(account, this._device, this._coinData))
    await Promise.all(this._esAccounts.init())
  }

  // TODO some block may forked and became orphan in the future, some txs and utxos may be invalid
  async _sync () {
    await this._device.sync()

    if (this._esAccounts.length === 0) {
      console.info('no accounts, new wallet, start recovery')
      await this._recover(D.TEST_MODE ? D.COIN_BIT_COIN_TEST : D.COIN_BIT_COIN)
    }
    await Promise.all(this._esAccounts.map(esAccount => esAccount.sync()))
  }

  async _recover (coinType) {
    while (true) {
      let account
      account = await this.newAccount(coinType, false)
      let esAccount = new EsAccount(account, this._device, this._coinData)
      await esAccount.init()
      await esAccount.sync()
      // new account has no transactions, recover finish
      if (esAccount.getTxInfos().length === 0) {
        await esAccount.delete()
        break
      }
    }
  }

  _release () {
    return this._coinData.release()
  }

  listenStatus (callback) {
    this._callback = callback
    switch (this._status) {
      case D.STATUS_PLUG_IN:
        callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
        break
      case D.STATUS_INITIALIZING:
        callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
        callback(D.ERROR_NO_ERROR, D.STATUS_INITIALIZING)
        break
      case D.STATUS_SYNCING:
        callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
        callback(D.ERROR_NO_ERROR, D.STATUS_INITIALIZING)
        callback(D.ERROR_NO_ERROR, D.STATUS_SYNCING)
        break
      case D.STATUS_SYNC_FINISH:
        callback(D.ERROR_NO_ERROR, D.STATUS_PLUG_IN)
        callback(D.ERROR_NO_ERROR, D.STATUS_INITIALIZING)
        callback(D.ERROR_NO_ERROR, D.STATUS_SYNCING)
        callback(D.ERROR_NO_ERROR, D.STATUS_SYNC_FINISH)
        break
      case D.STATUS_PLUG_OUT:
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
  getAccounts (filter) {
    return this._esAccounts
  }

  async newAccount (deviceID, passPhraseID, coinType) {
    let account = await this._coinData.newAccount(deviceID, passPhraseID, coinType)
    let esAccount = new EsAccount(account, this._device, this._coinData)
    await esAccount.init()
    this._esAccounts.push(esAccount)
    return esAccount
  }

  async availableNewAccountCoinTypes () {
    let availables = []
    for (let coinType of AVAILABLE_COIN_TYPES) {
      if (this._coinData.newAccountIndex(coinType) >= 0) {
        availables.push(coinType)
      }
    }
    return availables
  }

  getWalletInfo () {
    return this._device.getWalletInfo()
  }
}
