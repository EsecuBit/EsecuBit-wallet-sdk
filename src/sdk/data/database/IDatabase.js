
import D from '../../D'

export default class IDatabase {
  // TODO update API
  async saveAccount (account) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async getAccounts (deviceID, passPhraseID) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async saveTxInfo (txInfo) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  /**
   * @param filter {accountId}
   */
  async getTxInfos (filter) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async saveOrUpdateAddressInfo (addressInfo) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  /**
   *
   * @param filter {coinType}
   */
  async getAddressInfos (filter) {
    throw D.ERROR_NOT_IMPLEMENTED
  }
}
