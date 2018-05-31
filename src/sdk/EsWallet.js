
import D from './D'
import JsWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import CoinData from './data/CoinData'

// TODO surrounded with try catch
export default class EsWallet {
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
          await this._coinData.sync()
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
    let info = await this._device.init()
    return this._coinData.init(info)
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
    return this._coinData.getAccounts(filter)
  }

  newAccount (deviceID, passPhraseID, coinType) {
    return this._coinData.newAccount(deviceID, passPhraseID, coinType)
  }

  getWalletInfo () {
    return JsWallet.getWalletInfo()
  }

  getFloatValue (coinType, fee) {
    return D.getFloatValue(coinType, fee)
  }
}
