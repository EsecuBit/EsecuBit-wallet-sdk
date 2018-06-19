
import D from '../../D'

export default class IDatabase {

  async init () {
    throw D.error.notImplemented
  }

  async release () {
    throw D.error.notImplemented
  }

  async clearDatabase () {
    throw D.error.notImplemented
  }

  async deleteDatabase () {
    throw D.error.notImplemented
  }

  async newAccount (account) {
    throw D.error.notImplemented
  }

  async deleteAccount (account, addressInfos) {
    throw D.error.notImplemented
  }

  async getAccounts (filter) {
    throw D.error.notImplemented
  }

  async renameAccount (account) {
    throw D.error.notImplemented
  }

  async saveOrUpdateTxInfo (txInfo) {
    throw D.error.notImplemented
  }

  async getTxInfos (filter) {
    throw D.error.notImplemented
  }

  async newAddressInfos (account, addressInfos) {
    throw D.error.notImplemented
  }

  async getAddressInfos (filter) {
    throw D.error.notImplemented
  }

  async getUtxos (filter = {}) {
    throw D.error.notImplemented
  }

  async newTx (account, addressInfo, txInfo, utxos = []) {
    throw D.error.notImplemented
  }

  async getFee (coinType) {
    throw D.error.notImplemented
  }

  async saveOfUpdateFee (fee) {
    throw D.error.notImplemented
  }

  async getExchange (coinType) {
    throw D.error.notImplemented
  }

  async saveOfUpdateExchange (exchange) {
    throw D.error.notImplemented
  }
}
