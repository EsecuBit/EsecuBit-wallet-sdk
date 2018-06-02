
import D from '../D'
import IndexedDB from './database/IndexedDB'
import BlockChainInfo from './network/BlockChainInfo'
import JsWallet from '../device/JsWallet'
import CoreWallet from '../device/CoreWallet'

// TODO CoinData only manage data, don't handle data. leave it to EsAccount and EsWallet?
export default class CoinData {
  constructor () {
    if (CoinData.prototype.Instance) {
      return CoinData.prototype.Instance
    }
    CoinData.prototype.Instance = this

    this._initialized = false
    this._device = D.TEST_JS_WALLET ? new JsWallet() : new CoreWallet()
    // TODO read provider from settings
    this._networkProvider = BlockChainInfo
    this._network = {}
    if (D.TEST_MODE) {
      this._network[D.COIN_BIT_COIN_TEST] = new this._networkProvider(D.COIN_BIT_COIN_TEST)
    } else {
      this._network[D.COIN_BIT_COIN] = new this._networkProvider(D.COIN_BIT_COIN)
    }

    this._listeners = []
  }

  async init (info) {
    try {
      // TODO real with dependenices between device, coin data and wallet
      if (this._initialized) return
      this._db = new IndexedDB(info.walletId)
      let initList = []
      initList.push(this._db.init())
      initList.concat(Object.values(this._network).map(network => network.init()))
      await Promise.all(initList)
      this._initialized = true
    } catch (e) {
      console.info(e)
      throw D.ERROR_UNKNOWN
    }
  }

  async release () {
    this._listeners = []
    await Promise.all(Object.values(this._network).map(network => network.release()))
    if (this._db) await this._db.release()
  }

  async getAccounts (filter = {}) {
    return this._db.getAccounts(filter)
  }

  async _newAccount (coinType, accountIndex) {
    let makeId = function () {
      let text = ''
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
      }
      return text
    }

    let account = {
      accountId: makeId(),
      label: 'Account#' + (accountIndex + 1),
      coinType: coinType,
      index: accountIndex,
      balance: 0
    }
    let externalPath = D.makeBip44Path(coinType, accountIndex, true)
    let changePath = D.makeBip44Path(coinType, accountIndex, false)
    account.externalPublicKey = await this._device.getPublicKey(externalPath)
    account.externalPublicKeyIndex = 0
    account.changePublicKey = await this._device.getPublicKey(changePath)
    account.changePublicKeyIndex = 0
    console.info('newAccount', account)
    return account
  }

  /**
   * according to BIP32, check whether the spec coinType has account or the last spec coinType account has transaction
   * @return index of new account, -1 if unavailable
   */
  async newAccountIndex (coinType) {
    let accounts = await this._db.getAccounts()

    // check whether the last spec coinType account has transaction
    let lastAccount = null
    let accountIndex = 0
    for (let account of accounts) {
      if (account.coinType === coinType) {
        lastAccount = account
        accountIndex++
      }
    }

    // TODO check whether lastAccount is the last account created
    if (lastAccount === null) {
      return 0
    }
    let {total} = await this._db.getTxInfos(
      {
        accountId: lastAccount.accountId,
        startIndex: 0,
        endIndex: 1
      })
    if (total === 0) {
      return -1
    }
    return accountIndex
  }

  async newAccount (coinType, save = true) {
    let accountIndex = await await this.newAccountIndex(coinType)
    if (accountIndex === -1) {
      throw D.ERROR_LAST_ACCOUNT_NO_TRANSACTION
    }

    let account = await this._newAccount(coinType, accountIndex)
    if (D.TEST_DATA && accountIndex === 0 && (coinType === D.COIN_BIT_COIN || coinType.D.COIN_BIT_COIN_TEST)) {
      await this._initTestDbData(account)
    }
    if (save) await this._db.newAccount(account)
    return account
  }

  async deleteAccount (account) {
    let txInfos = this._db.getTxInfos({accountId: account.accountId})
    if (txInfos.length !== 0) {
      throw D.ERROR_ACCOUNT_HAS_TRANSACTIONS
    }
    return this._db.deleteAccount(account)
  }

  async sendTx (account, utxos, txInfo, rawTx) {
    let coinType = txInfo.coinType
    await this._network[coinType].sendTx(rawTx)
  }

  async saveOrUpdateTxInfo (txInfo) {
    await this._db.saveOrUpdateTxInfo(txInfo)
    this._listeners.forEach(listener => listener(D.ERROR_NO_ERROR, txInfo))
  }

  getTxInfos (filter) {
    return this._db.getTxInfos(filter)
  }

  getUtxos (filter) {
    return this._db.getUtxos(filter)
  }

  async newTx (account, addressInfo, txInfo, utxos) {
    await this._db.newTx(account, addressInfo, txInfo, utxos)
    this._listeners.forEach(listener => listener(D.ERROR_NO_ERROR, txInfo))
  }

  checkAddresses (coinType) {
    return this._network[coinType].checkAddresses(coinType)
  }

  listenAddresses (coinType, callback) {
    return this._db.listenAddresses(coinType, callback)
  }

  addListener (callback) {
    let exists = this._listeners.some(listener => listener === callback)
    if (exists) {
      console.info('addTransactionListener already has this listener', callback)
      return
    }
    this._listeners.push(callback)
  }

  /*
   * Test data when TEST_DATA=true
   */
  async _initTestDbData (account) {
    console.info('TEST_DATA add test txInfo')
    console.info('initTestDbData')
    account.balance = 32000000
    let accountId = account.accountId
    await Promise.all([
      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.COIN_BIT_COIN,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
          address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
          direction: D.TX_DIRECTION_IN,
          time: 1524138384000,
          outIndex: 0,
          script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
          value: 84000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.COIN_BIT_COIN,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
          address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
          direction: D.TX_DIRECTION_OUT,
          time: 1524138384000,
          value: 18000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateTxInfo(
        {
          accountId: accountId,
          coinType: D.COIN_BIT_COIN,
          txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
          address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
          direction: D.TX_DIRECTION_OUT,
          time: 1524138384000,
          value: 34000000,
          hasDetails: false
        }),

      this._db.saveOrUpdateAddressInfo(
        {
          address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
          accountId: accountId,
          coinType: D.COIN_BIT_COIN,
          path: [0x80000000, 0x8000002C, 0x80000000, 0x00000000, 0x00000000],
          type: D.ADDRESS_EXTERNAL,
          txIds: []
        })
    ])
  }
}
