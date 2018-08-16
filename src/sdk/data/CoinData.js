
import D from '../D'
import BlockChainInfo from './network/BlockChainInfo'
import FeeBitCoinEarn from './network/fee/FeeBitCoinEarn'
import ExchangeCryptoCompareCom from './network/exchange/ExchangeCryptoCompareCom'
import EthGasStationInfo from './network/fee/EthGasStationInfo'
import EtherScanIo from './network/EtherScanIo'
import Provider from '../Provider'

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
      }
      return obj
    }, {})
    this._networkFee = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})
    this._exchange = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})

    this._listeners = []
  }

  async init (info, offlineMode = false) {
    try {
      // db
      this._globalDb = new Provider.DB('default')
      await this._globalDb.init()
      if (offlineMode) {
        let lastWalletId = await this._globalDb.getSettings('lastWalletId')
        if (!lastWalletId) {
          // noinspection ExceptionCaughtLocallyJS
          throw D.error.offlineModeNotAllowed
        }
        info = {walletId: lastWalletId}
      } else {
        await this._globalDb.saveOrUpdateSettings('lastWalletId', info.walletId)
      }

      console.log('walletInfo', info)
      this._db = new Provider.DB(info.walletId)
      await this._db.init()

      // network
      await Promise.all(Object.values(this._network).map(network => network.init()))

      // fee
      await Promise.all(Object.keys(this._networkFee).map(async coinType => {
        if (this._networkFee[coinType]) return this._networkFee[coinType]
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
        if (this._exchange[coinType]) return this._exchange[coinType]
        let exchange = await this._db.getExchange(coinType)
        exchange = exchange || {coinType}
        this._exchange[coinType] = new ExchangeCryptoCompareCom(exchange)
        this._exchange[coinType].onUpdateExchange = (fee) => this._db.saveOrUpdateExchange(fee)
      }))

      console.log('coin data init finish', this._db)
    } catch (e) {
      // TODO throw Error instead of int in the whole project
      if (typeof e === 'number') {
        throw e
      }
      console.warn('coin data init got unknown error', e)
      throw D.error.unknown
    }
  }

  async release () {
    this._listeners = []
    await Promise.all(Object.values(this._network).map(network => network.release()))
    if (this._db) await this._db.release()
  }

  async getAccounts (filter = {}) {
    return (await this._db.getAccounts(filter)).sort((a, b) => a.index - b.index)
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

  getProviders () {
    let providers = {}
    D.supportedCoinTypes().forEach(coin => {
      providers[coin] = {}
    })
    Object.values(this._network).forEach(network => {
      providers[network.coinType]['network'] = network.provider
    })
    Object.values(this._networkFee).forEach(fee => {
      providers[fee.coinType]['fee'] = fee.provider
    })
    Object.values(this._exchange).forEach(exchange => {
      providers[exchange.coinType]['exchange'] = exchange.provider
    })
    return providers
  }

  async newAccount (coinType) {
    let accountIndex = await await this._newAccountIndex(coinType)
    if (accountIndex === -1) throw D.error.lastAccountNoTransaction

    let account = await this._newAccount(coinType, accountIndex)
    if (D.test.data && accountIndex === 0 && (D.isBtc(coinType))) {
      await this._initTestDbData(account)
    }
    await this._db.newAccount(account)
    return account
  }

  async _newAccount (coinType, accountIndex) {
    let makeId = () => {
      let text = ''
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length))
      return text
    }

    let account = {
      accountId: makeId(),
      label: 'Account#' + (accountIndex + 1),
      coinType: coinType,
      index: accountIndex,
      balance: '0',
      externalPublicKeyIndex: 0,
      changePublicKeyIndex: 0
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

    let {total} = await this._db.getTxInfos({
      accountId: lastAccount.accountId,
      startIndex: 0,
      endIndex: 1
    })
    if (total === 0) return -1
    return lastAccount.index + 1
  }

  async deleteAccount (account) {
    let {total} = await this._db.getTxInfos({accountId: account.accountId})
    let addressInfos = await this._db.getAddressInfos({accountId: account.accountId})
    if (total !== 0) {
      console.warn('attemp to delete a non-empty account', account)
      throw D.error.accountHasTransactions
    }
    console.log('delete account', account)
    await this._db.deleteAccount(account, addressInfos)
  }

  async renameAccount (account) {
    this._db.renameAccount(account)
  }

  async newAddressInfos (account, addressInfos) {
    await this._db.newAddressInfos(account, addressInfos)
  }

  getAddressInfos (filter) {
    return this._db.getAddressInfos(filter)
  }

  async getTxInfos (filter) {
    let {total, txInfos} = await this._db.getTxInfos(filter)
    txInfos.forEach(txInfo => (txInfo.link = this._network[txInfo.coinType].getTxLink(txInfo)))
    return {total, txInfos}
  }

  getUtxos (filter) {
    return this._db.getUtxos(filter)
  }

  updateTxComment (txInfo, comment) {
    return this._db.updateTxComment(txInfo, comment)
  }

  async newTx (account, addressInfo, txInfo, utxos) {
    await this._db.newTx(account, addressInfo, txInfo, utxos)
    this._listeners.forEach(listener => D.dispatch(() => listener(D.error.succeed, txInfo)))
  }

  clearData () {
    return this._db.clearDatabase()
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

  async sendTx (account, utxos, txInfo, rawTx) {
    await this._network[account.coinType].sendTx(rawTx)
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
      let unitValue = Number(D.convertValue(coinType, value, toType, exchange.unit))
      return (rRate && (unitValue / rRate)).toString()
    } else if (toLegal) {
      let exchange = this._exchange[coinType].getCurrentExchange()
      let rate = Number(exchange.exchange[toType])
      let unitValue = Number(D.convertValue(coinType, value, fromType, exchange.unit))
      return (unitValue * rate).toString()
    } else {
      return D.convertValue(coinType, value, fromType, toType).toString()
    }
  }

  /*
   * Test data when test.data = true
   * @deprecated
   */
  async _initTestDbData () {
    console.log('D.test.data add test txInfo')
  }
}
