
import D from '../D'
import BlockChainInfo from './network/BlockChainInfo'
import FeeBitCoinEarn from './network/fee/FeeBitCoinEarn'
import EosPeer from './network/EosPeer'
import ExchangeCryptoCompareCom from './network/exchange/ExchangeCryptoCompareCom'
import EthGasStationInfo from './network/fee/EthGasStationInfo'
import EtherScanIo from './network/EtherScanIo'
import Provider from '../Provider'

const shouldResendTime = 3 * 3600 * 1000
const checkShouldResendTime = 60 * 1000

export default class CoinData {
  constructor () {
    if (CoinData.prototype.Instance) {
      return CoinData.prototype.Instance
    }
    CoinData.prototype.Instance = this

    const coinTypes = D.supportedCoinTypes()
    this._network = coinTypes.reduce((obj, coinType) => {
      if (D.isBtc(coinType)) {
        obj[coinType] = new BlockChainInfo(coinType)
      } else if (D.isEth(coinType)) {
        obj[coinType] = new EtherScanIo(coinType)
      } else if (D.isEos(coinType)) {
        obj[coinType] = new EosPeer(coinType)
      }
      return obj
    }, {})
    this._networkFee = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})
    this._exchange = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})

    this._listeners = []
  }

  async init (info) {
    if (!info || !info.walletId) {
      console.warn('CoinData needs info.walletId to init', info)
      throw D.error.invalidParams
    }

    console.log('walletInfo', info)
    try {
      // db
      this._db = new Provider.DB(info.walletId)
      await this._db.init()

      // fee
      await Promise.all(Object.keys(this._networkFee).map(async coinType => {
        if (this._networkFee[coinType]) {
          this._networkFee[coinType].updateFee()
          return this._networkFee[coinType]
        }
        let fee = await this._db.getFee(coinType)
        fee = fee || {coinType}
        if (D.isBtc(coinType)) {
          this._networkFee[coinType] = new FeeBitCoinEarn(fee)
          this._networkFee[coinType].onUpdateFee = (fee) => this._db.saveOrUpdateFee(fee)
        } else if (D.isEth(coinType)) {
          this._networkFee[coinType] = new EthGasStationInfo(fee)
          this._networkFee[coinType].onUpdateFee = (fee) => this._db.saveOrUpdateFee(fee)
        }
      }))

      // exchange
      await Promise.all(Object.keys(this._exchange).map(async coinType => {
        if (this._exchange[coinType]) {
          this._exchange[coinType].updateExchange()
          return this._exchange[coinType]
        }
        let exchange = await this._db.getExchange(coinType)
        exchange = exchange || {coinType}
        this._exchange[coinType] = new ExchangeCryptoCompareCom(exchange)
        this._exchange[coinType].onUpdateExchange = (fee) => this._db.saveOrUpdateExchange(fee)
      }))

      // check the tx whether it is over time uncomfirmed
      this._uncomfirmedTxs = []
      this._unconfirmedCheck = async (firstInit = false) => {
        if (!firstInit && !this.initialized) return
        if (firstInit) {
          this._uncomfirmedTxs = []
          let txInfos = await this._db.getTxInfos()
          for (let txInfo of txInfos) {
            this.setTxFlags(txInfo)
            if (txInfo.canResend && !txInfo.shouldResend) {
              this._uncomfirmedTxs.push(txInfo)
            }
          }
        }

        for (let txInfo of this._uncomfirmedTxs) {
          this.setTxFlags(txInfo)
          if (txInfo.canResend && txInfo.shouldResend) {
            this._listeners.forEach(listener => D.dispatch(() => listener(D.error.succeed, D.copy(txInfo))))
            this._uncomfirmedTxs = this._uncomfirmedTxs.filter(t => t.txId !== txInfo.txId)
          }
        }

        setTimeout(this._unconfirmedCheck, checkShouldResendTime)
      }
      await this._unconfirmedCheck(true)

      console.log('coin data init finish', info)
      this.initialized = true
    } catch (e) {
      // TODO throw Error instead of int in the whole project
      if (typeof e === 'number') {
        throw e
      }
      console.warn('coin data init got unknown error', e)
      throw D.error.unknown
    }
  }

  async initNetWork () {
    // network
    await Promise.all(Object.values(this._network).map(network => network.init()))
    await Promise.all(Object.values(this._network).map(network => network.sync()))
  }

  async sync () {
  }

  async release () {
    this._listeners = []
    await Promise.all(Object.values(this._network).map(network => network.release()))
    if (this._db) await this._db.release()
    this.initialized = false
    this._uncomfirmedTxs = []
  }

  async getAccounts (filter = {}) {
    let accounts = []
    if (this._db) {
      accounts = await this._db.getAccounts(filter)
      accounts.sort((a, b) => a.index - b.index)
    }
    return accounts
  }

  setListner (callback) {
    callback = callback || (() => {})
    this._listeners = [callback]
  }

  addListener (callback) {
    let exists = this._listeners.some(listener => listener === callback)
    if (exists) {
      console.log('addTransactionListener already has this listener', callback)
      return
    }
    this._listeners.push(callback)
  }

  removeListener (callback) {
    this._listeners = this._listeners.filter(listener => listener !== callback)
  }

  /**
   * Get network API providers.
   */
  getProviders () {
    let providers = {}
    D.supportedCoinTypes().forEach(coin => {
      providers[coin] = {}
    })
    Object.values(this._network).forEach(network => {
      if (network && network.provider) {
        providers[network.coinType]['network'] = network.provider
      }
    })
    Object.values(this._networkFee).forEach(fee => {
      if (fee && fee.provider) {
        providers[fee.coinType]['fee'] = fee.provider
      }
    })
    Object.values(this._exchange).forEach(exchange => {
      if (exchange && exchange.provider) {
        providers[exchange.coinType]['exchange'] = exchange.provider
      }
    })
    return providers
  }

  async newAccount (coinType, permission) {
    let accountIndex = await await this._newAccountIndex(coinType)
    if (accountIndex === -1) throw D.error.lastAccountNoTransaction

    let account = await this._newAccount(coinType, accountIndex, permission)
    await this._db.newAccount(account)
    return account
  }

  async _newAccount (coinType, accountIndex, permission) {
    let makeId = () => {
      let id = ''
      const possible = '0123456789abcdef'
      for (let i = 0; i < 8; i++) id += possible.charAt(Math.floor(Math.random() * possible.length))
      // obviously it's no need for random part(id), but we keep it for unpredictable future
      return coinType + '_' + accountIndex + '_' + id
    }
    let status = D.account.status.hideByNoTxs
    let label = 'Account#' + (accountIndex + 1)
    let type = 0
    // eos account should be show directly
    if (D.isEos(coinType)) {
      status = D.account.status.show
      // recovery eos account
      if (permission) {
        label = permission.actor
        type = permission.type
      }
    }
    let account = {
      accountId: makeId(),
      label: label,
      status: status,
      coinType: coinType,
      index: accountIndex,
      balance: '0',
      externalPublicKeyIndex: 0,
      changePublicKeyIndex: 0,
      queryOffset: 0,
      type: type
    }
    console.log('newAccount', account)
    return account
  }

  /**
   * according to BIP32, check whether the spec coinType has account or the last spec coinType account has transaction
   * @return index of new account, -1 if unavailable
   */
  async _newAccountIndex (coinType) {
    if (!coinType) return -1
    let accounts = await this._db.getAccounts({coinType})
    // check whether the last spec coinType account has transaction
    let lastAccount = accounts.reduce(
      (lastAccount, account) => lastAccount.index > account.index ? lastAccount : account,
      accounts[0])

    if (!lastAccount) return 0

    let txInfos = await this._db.getTxInfos({accountId: lastAccount.accountId})
    if (!D.isEos(coinType) && txInfos.length === 0) return -1
    return lastAccount.index + 1
  }

  async deleteAccount (account) {
    let txInfos = await this._db.getTxInfos({accountId: account.accountId})
    if (txInfos.length !== 0) {
      console.warn('attemp to delete a non-empty account', account)
      throw D.error.accountHasTransactions
    }
    console.log('delete account', account)
    let addressInfos = await this._db.getAddressInfos({accountId: account.accountId})
    await this._db.deleteAccount(account, addressInfos)
  }

  async updateAccount (account) {
    this._db.updateAccount(account)
  }

  async newToken (token) {
    this._db.newToken(token)
  }

  async updateToken (token) {
    return this._db.updateToken(token)
  }

  async getTokens (filter) {
    return this._db.getTokens(filter)
  }

  async deleteToken (token) {
    this._db.deleteToken(token)
  }

  async newAddressInfos (account, addressInfos) {
    await this._db.newAddressInfos(account, addressInfos)
  }

  async updateAddressInfos (addressInfos) {
    await this._db.updateAddressInfos(addressInfos)
  }

  async deleteAddressInfos (addressInfos) {
    await this._db.deleteAddressInfos(addressInfos)
  }

  async getAddressInfos (filter) {
    return this._db.getAddressInfos(filter)
  }

  async getTxInfos (filter) {
    return this._db.getTxInfos(filter)
  }

  getUtxos (filter) {
    return this._db.getUtxos(filter)
  }

  updateTxComment (txInfo) {
    return this._db.saveOrUpdateTxComment(txInfo)
  }

  async newTx (account, addressInfos, txInfo, utxos = []) {
    let unconfirmedTxInfo = D.copy(txInfo)
    this.setTxFlags(unconfirmedTxInfo)
    this._uncomfirmedTxs.push(unconfirmedTxInfo)

    console.log('newTx', account.accountId, addressInfos.map(a => a.address),
      txInfo.txId, utxos.map(u => JSON.stringify(u)))
    await this._db.newTx(account, addressInfos, txInfo, utxos)
    this._listeners.forEach(listener => D.dispatch(() => listener(D.error.succeed, txInfo)))
  }

  async removeTx (account, addressInfos, txInfo, updateUtxos = [], removeUtxos = []) {
    this._uncomfirmedTxs = this._uncomfirmedTxs.filter(t => t.txId !== txInfo.txId)

    console.log('removeTx', account.accountId, addressInfos.map(a => a.address), txInfo.txId,
      updateUtxos.map(u => JSON.stringify(u)), removeUtxos.map(u => JSON.stringify(u)))
    await this._db.removeTx(account, addressInfos, txInfo, updateUtxos, removeUtxos)
    this._listeners.forEach(listener => D.dispatch(() => listener(D.error.succeed, D.copy(txInfo))))
  }

  /**
   * txFlags:
   * link: link of tx details in network provider's website
   * canResend: this tx can be resent
   * shouldResend: this tx should be resent
   */
  setTxFlags (txInfo) {
    if (txInfo.direction === D.tx.direction.out) {
      txInfo.canResend = txInfo.confirmations === 0
      if (txInfo.canResend) {
        txInfo.shouldResend = new Date().getTime() - txInfo.time > shouldResendTime
      }
    }
    if (!this._network[txInfo.coinType]) {
      // this is a bug but we havn't find it out
      console.warn('unable to get tx link', txInfo.coinType, txInfo, this._network)
      txInfo.link = ''
    } else {
      txInfo.link = this._network[txInfo.coinType].getTxLink(txInfo)
    }
    return txInfo
  }

  /**
   * Clear all data in database.
   */
  async clearData () {
    await this._db.clearDatabase()
  }

  checkAddresses (coinType, addressInfos) {
    return this._network[coinType].checkAddresses(addressInfos)
  }

  listenAddresses (coinType, addressInfos, callback) {
    console.log('listen addresses', addressInfos)
    return this._network[coinType].listenAddresses(addressInfos, callback)
  }

  listenTx (coinType, txInfo, callback) {
    console.log('listen txInfo', txInfo)
    return this._network[coinType].listenTx(txInfo, callback)
  }

  removeNetworkListener (coinType, callback) {
    return this._network[coinType].removeListener(callback)
  }

  async sendTx (coinType, rawTx) {
    await this._network[coinType].sendTx(rawTx)
  }

  /**
   * Expose blockchain API to IAccount for specific API.
   * @param coinType
   * @returns ICoinNetwork
   */
  getNetwork (coinType) {
    return this._network[coinType]
  }

  getSuggestedFee (coinType) {
    if (!D.supportedCoinTypes().includes(coinType)) {
      throw D.error.coinNotSupported
    }
    return this._networkFee[coinType].getCurrentFee()
  }

  convertValue (coinType, value, fromType, toType) {
    let fromLegal = D.suppertedLegals().includes(fromType)
    let toLegal = D.suppertedLegals().includes(toType)
    // not support convertion between legal currency
    if (fromLegal && toLegal) {
      throw D.error.coinNotSupported
    } else if (fromLegal) {
      let exchange = this._exchange[coinType].getCurrentExchange()
      let rRate = Number(exchange.exchange[fromType])
      return D.convertValue(coinType, value / rRate, exchange.unit, toType)
    } else if (toLegal) {
      let exchange = this._exchange[coinType].getCurrentExchange()
      let rate = Number(exchange.exchange[toType])
      let unitValue = Number(D.convertValue(coinType, value, fromType, exchange.unit))
      return (unitValue * rate).toString()
    } else {
      return D.convertValue(coinType, value, fromType, toType).toString()
    }
  }
}
