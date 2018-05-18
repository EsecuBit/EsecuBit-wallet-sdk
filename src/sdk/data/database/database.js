
const D = require('../../D').class

const Database = function () {
}
module.exports = {class: Database}

// noinspection JSUnusedLocalSymbols
Database.prototype.saveAccount = async function (account) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
Database.prototype.getAccounts = async function (deviceID, passPhraseID) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
Database.prototype.saveTransactionInfo = async function (transactionInfo) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {accountId}
 */
Database.prototype.getTransactionInfos = async function (filter) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
Database.prototype.saveOrUpdateAddressInfo = async function (addressInfo) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {coinType}
 */
Database.prototype.getAddressInfos = async function (filter) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}