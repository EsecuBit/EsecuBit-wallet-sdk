
const D = require('../../D').class

const IDatabase = function () {
}
module.exports = {class: IDatabase}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveAccount = async function (account) {
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.getAccounts = async function (deviceID, passPhraseID) {
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveTxInfo = async function (txInfo) {
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {accountId}
 */
IDatabase.prototype.getTxInfos = async function (filter) {
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
IDatabase.prototype.saveOrUpdateAddressInfo = async function (addressInfo) {
  throw D.ERROR_NOT_IMPLEMENTED
}

// noinspection JSUnusedLocalSymbols
/**
 *
 * @param filter {coinType}
 */
IDatabase.prototype.getAddressInfos = async function (filter) {
  throw D.ERROR_NOT_IMPLEMENTED
}