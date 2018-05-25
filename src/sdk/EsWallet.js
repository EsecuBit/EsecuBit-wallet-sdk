
const D = require('./D').class

const EsWallet = function () {
  if (D.TEST_JS_WALLET) {
    this._device = require('./device/JsWallet').instance
  } else {
    this._device = require('./device/CoreWallet').instance
  }
  this._coinData = require('./data/CoinData').instance
}
module.exports = {class: EsWallet}

EsWallet.prototype._init = async function () {
  let info = await this._device.init()
  await this._coinData.init(info)
}

EsWallet.prototype._release = function () {
  this._coinData.release()
}

EsWallet.prototype.listenStatus = function (callback) {
  this._device.listenPlug(async (error, plugStatus) => {
    let status = plugStatus;
    if (error !== D.ERROR_NO_ERROR) {
      callback(error, status)
      return
    }
    callback(D.ERROR_NO_ERROR, status)
    if (status === D.STATUS_PLUG_IN) {
      try {
        status = D.STATUS_INITIALIZING
        callback(D.ERROR_NO_ERROR, status)
        await this._init()
        status = D.STATUS_SYNCING
        callback(D.ERROR_NO_ERROR, status)
        await this._coinData.sync()
        status = D.STATUS_SYNC_FINISH
        callback(D.ERROR_NO_ERROR, status)
      } catch (e) {
        callback(e, status)
      }
    } else {
      this._release()
    }
  })
}

/**
 * callback when new transaction detect or old transaction status update
 *
 * @returns {Promise<*>}
 */
EsWallet.prototype.listenTxInfo = function (callback) {
  return this._coinData.listenTxInfo(callback)
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
