
import D from '../../D'

export default class IDatabase {
  // TODO update API
  async saveAccount (account) {
    throw D.error.notImplemented
  }

  async getAccounts (deviceID, passPhraseID) {
    throw D.error.notImplemented
  }

  async saveTxInfo (txInfo) {
    throw D.error.notImplemented
  }

  /**
   * @param filter {accountId}
   */
  async getTxInfos (filter) {
    throw D.error.notImplemented
  }

  async saveOrUpdateAddressInfo (addressInfo) {
    throw D.error.notImplemented
  }

  /**
   *
   * @param filter {coinType}
   */
  async getAddressInfos (filter) {
    throw D.error.notImplemented
  }
}
