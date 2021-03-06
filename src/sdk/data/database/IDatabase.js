
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

  async updateAccount (account) {
    throw D.error.notImplemented
  }

  async saveOrUpdateTxComment (txInfo) {
    throw D.error.notImplemented
  }

  async getTxInfos (filter) {
    throw D.error.notImplemented
  }

  async newAddressInfos (account, addressInfos) {
    throw D.error.notImplemented
  }

  async updateAddressInfos (addressInfos) {
    throw D.error.notImplemented
  }

  async getAddressInfos (filter) {
    throw D.error.notImplemented
  }

  async getUtxos (filter) {
    throw D.error.notImplemented
  }

  async newTx (account, addressInfos, txInfo, utxos = []) {
    throw D.error.notImplemented
  }

  async removeTx (account, addressInfos, txInfo, updateUtxos = [], removeUtxos = []) {
    throw D.error.notImplemented
  }

  async getFee (coinType) {
    throw D.error.notImplemented
  }

  async saveOrUpdateFee (fee) {
    throw D.error.notImplemented
  }

  async getExchange (coinType) {
    throw D.error.notImplemented
  }

  async saveOrUpdateExchange (exchange) {
    throw D.error.notImplemented
  }

  async getSettings (coinType) {
    throw D.error.notImplemented
  }

  async saveOrUpdateSettings (exchange) {
    throw D.error.notImplemented
  }
}
