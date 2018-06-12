
import D from '../D'
import IndexedDB from './database/IndexedDB'
import BlockChainInfo from './network/BlockChainInfo'
import FeeBitCoinEarn from './network/fee/FeeBitCoinEarn'
import ExchangeCryptoCompareCom from './network/exchange/ExchangeCryptoCompareCom'
import EthGasStationInfo from './network/fee/EthGasStationInfo'
import EtherScanIo from './network/EtherScanIo'

// TODO CoinData only manage data, don't handle data. leave it to BtcAccount and EsWallet?
export default class CoinData {
  constructor () {
    if (CoinData.prototype.Instance) {
      return CoinData.prototype.Instance
    }
    CoinData.prototype.Instance = this

    this._initialized = false

    const coinTypes = D.suppertedCoinTypes()
    this._network = coinTypes.reduce((obj, coinType) => {
      // TODO read provider from settings
      if (coinType.includes('btc')) {
        obj[coinType] = new BlockChainInfo(coinType)
      } else if (coinType.includes('eth')) {
        obj[coinType] = new EtherScanIo(coinType)
      }
      return obj
    }, {})
    this._networkFee = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})
    this._exchange = coinTypes.reduce((obj, coinType) => (obj[coinType] = null) || obj, {})

    this._listeners = []
  }

  async init (info) {
    try {
      if (this._initialized) return
      this._db = new IndexedDB(info.walletId)
      // db
      await this._db.init()
      // network
      await Promise.all(Object.values(this._network).map(network => network.init()))
      // fee
      await Promise.all(Object.keys(this._networkFee).map(async coinType => {
        let fee = await this._db.getFee(coinType)
        fee = fee || {coinType}
        if (coinType.includes('btc')) {
          this._networkFee[coinType] = new FeeBitCoinEarn(fee)
          this._networkFee[coinType].onUpdateFee = (fee) => this._db.saveOfUpdateFee(fee)
        } else if (coinType.includes('eth')) {
          this._networkFee[coinType] = new EthGasStationInfo(fee)
          this._networkFee[coinType].onUpdateFee = (fee) => this._db.saveOfUpdateFee(fee)
        }
      }))
      // exchange
      await Promise.all(Object.keys(this._exchange).map(async coinType => {
        let exchange = await this._db.getExchange(coinType)
        exchange = exchange || {coinType}
        this._exchange[coinType] = new ExchangeCryptoCompareCom(exchange)
        this._exchange[coinType].onUpdateExchange = (fee) => this._db.saveOfUpdateExchange(fee)
      }))

      this._initialized = true
    } catch (e) {
      console.warn(e)
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

  async newAccount (coinType) {
    let accountIndex = await await this._newAccountIndex(coinType)
    if (accountIndex === -1) throw D.error.lastAccountNoTransaction

    let account = await this._newAccount(coinType, accountIndex)
    if (D.test.data && accountIndex === 0 && (coinType === D.coin.main.btc || coinType.D.coin.test.btcTestNet3)) {
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
      balance: 0
    }
    console.log('newAccount', account)
    return account
  }

  /**
   * according to BIP32, check whether the spec coinType has account or the last spec coinType account has transaction
   * @return index of new account, -1 if unavailable
   */
  async _newAccountIndex (coinType) {
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

  async saveOrUpdateTxInfo (txInfo) {
    console.log('yeah', txInfo)
    await this._db.saveOrUpdateTxInfo(txInfo)
    this._listeners.forEach(listener => listener(D.error.succeed, txInfo))
  }

  async newAddressInfos (account, addressInfos) {
    await this._db.newAddressInfos(account, addressInfos)
  }

  getAddressInfos (filter) {
    return this._db.getAddressInfos(filter)
  }

  getTxInfos (filter) {
    return this._db.getTxInfos(filter)
  }

  getUtxos (filter) {
    return this._db.getUtxos(filter)
  }

  async newTx (account, addressInfo, txInfo, utxos) {
    await this._db.newTx(account, addressInfo, txInfo, utxos)
    this._listeners.forEach(listener => listener(D.error.succeed, txInfo))
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
    switch (coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        return this._networkFee[coinType].getCurrentFee()
      default:
        throw D.error.coinNotSupported
    }
  }

  convertValue (coinType, value, fromType, toType) {
    let fromLegal = D.suppertedLegals().includes(fromType)
    let toLegal = D.suppertedLegals().includes(toType)
    // not support convertion between legal currency
    if (fromLegal && toLegal) {
      throw D.error.coinNotSupported
    } else if (fromLegal) {
      let exchange = this._exchange[coinType].getCurrentExchange()
      let rRate = exchange.exchange[fromType]
      let unitValue = D.convertValue(coinType, value, toType, exchange.unit)
      return rRate && (unitValue / rRate)
    } else if (toLegal) {
      let exchange = this._exchange[coinType].getCurrentExchange()
      let rate = exchange.exchange[toType]
      let unitValue = D.convertValue(coinType, value, fromType, exchange.unit)
      return unitValue * rate
    } else {
      return D.convertValue(coinType, value, fromType, toType)
    }
  }

  /*
   * Test data when test.data = true
   */
  async _initTestDbData (account) {
    console.log('test.data add test txInfo')
    account.balance = 32000000
    let accountId = account.accountId
    // TODO update data
    await Promise.all([
      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.coin.main.btc,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
          address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
          direction: D.tx.direction.in,
          time: 1524138384000,
          outIndex: 0,
          script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
          value: 84000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.coin.main.btc,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
          address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
          direction: D.tx.direction.out,
          time: 1524138384000,
          value: 18000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.coin.main.btc,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
          address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
          direction: D.tx.direction.out,
          time: 1524138384000,
          value: 34000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateAddressInfo(
        {
          address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
          accountId: accountId,
          coinType: D.coin.main.btc,
          path: [0x80000000, 0x8000002C, 0x80000000, 0x00000000, 0x00000000],
          type: D.address.external,
          txIds: []
        })
    ])
  }
}
