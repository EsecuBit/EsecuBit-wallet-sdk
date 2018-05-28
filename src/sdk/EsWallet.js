
const D = require('./D').class

const EsWallet = function () {
  if (D.TEST_JS_WALLET) {
    this._device = require('./device/JsWallet').instance
  } else {
    this._device = require('./device/CoreWallet').instance
  }
  this._coinData = require('./data/CoinData').instance

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
      try {
        this._status = D.STATUS_INITIALIZING
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
        await this._init()
        this._status = D.STATUS_SYNCING
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
        await this._coinData.sync()
        this._status = D.STATUS_SYNC_FINISH
        this._callback && this._callback(D.ERROR_NO_ERROR, this._status)
      } catch (e) {
        this._callback && this._callback(e, status)
      }
    } else {
      this._release()
    }
  })
}

EsWallet.prototype._init = async function () {
  let info = await this._device.init()
  return this._coinData.init(info)
}

EsWallet.prototype._release = function () {
  return this._coinData.release()
}

EsWallet.prototype.listenStatus = function (callback) {
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
EsWallet.prototype.listenTxInfo = function (callback) {
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
EsWallet.prototype.getAccounts = function (filter) {
  return this._coinData.getAccounts(filter)
}

EsWallet.prototype.newAccount = function (deviceID, passPhraseID, coinType) {
  return this._coinData.newAccount(deviceID, passPhraseID, coinType)
}

EsWallet.prototype.getWalletInfo = function () {
  return this._device.getWalletInfo()
}

EsWallet.prototype.getSuggestedFee = function (transaction, coinType, feeType) {
  // TODO move to account
  // var transactionSize = 180 * ins + 34 * outs + 10
}

EsWallet.prototype.getFloatFee = function (coinType, fee) {
  return this._coinData.getFloatFee(coinType, fee)
}

module.exports = {instance: new EsWallet()}
