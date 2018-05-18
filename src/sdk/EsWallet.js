
const D = require('./D').class

const EsWallet = function () {
  this._device = require('./hardware/CoreWallet').instance
  this._coinData = require('./data/CoinData').instance
}
module.exports = {class: EsWallet}

EsWallet.prototype._init = function () {
  return Promise.all([this._device.init, this._coinData.init])
}

EsWallet.prototype._release = function () {
  this._coinData.release()
}

EsWallet.prototype.listenDevice = function (callback) {
  this._device.listenPlug((error, isPluged) => {
    if (error !== D.ERROR_NO_ERROR) {
      callback(error, isPluged)
      return
    }
    if (isPluged) {
      this._init(function (error) {
        callback(error, isPluged)
      })
    } else {
      this._release()
    }
  })
}

EsWallet.prototype.listenTransactionInfo = function () {
  return this._coinData.listenTransactionInfo()
}

EsWallet.prototype.getAccounts = function (deviceID, passPhraseID) {
  return this._coinData.getAccounts(deviceID, passPhraseID)
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
