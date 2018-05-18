
const D = require('../../D').class

const IDatabase = function () {
}
module.exports = {class: IDatabase}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveAccount = async function (account) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.getAccounts = async function (deviceID, passPhraseID) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveTransactionInfo = async function (transactionInfo) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {accountId}
 */
IDatabase.prototype.getTransactionInfos = async function (filter) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveOrUpdateAddressInfo = async function (addressInfo) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {coinType}
 */
IDatabase.prototype.getAddressInfos = async function (filter) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}