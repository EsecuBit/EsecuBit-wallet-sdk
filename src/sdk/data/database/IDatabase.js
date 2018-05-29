
import D from '../../D'

const IDatabase = function () {
}

// TODO update API

IDatabase.prototype.saveAccount = async function (account) {
  throw D.ERROR_NOT_IMPLEMENTED
}

IDatabase.prototype.getAccounts = async function (deviceID, passPhraseID) {
  throw D.ERROR_NOT_IMPLEMENTED
}

IDatabase.prototype.saveTxInfo = async function (txInfo) {
  throw D.ERROR_NOT_IMPLEMENTED
}

/**
 *
 * @param filter {accountId}
 */
IDatabase.prototype.getTxInfos = async function (filter) {
  throw D.ERROR_NOT_IMPLEMENTED
}

IDatabase.prototype.saveOrUpdateAddressInfo = async function (addressInfo) {
  throw D.ERROR_NOT_IMPLEMENTED
}

/**
 *
 * @param filter {coinType}
 */
IDatabase.prototype.getAddressInfos = async function (filter) {
  throw D.ERROR_NOT_IMPLEMENTED
}

export default IDatabase
