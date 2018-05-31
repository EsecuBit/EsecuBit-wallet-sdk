
import D from '../D'
import IndexedDB from './database/IndexedDB'
import BlockChainInfo from './network/BlockChainInfo'
import EsAccount from '../EsAccount'
import JsWallet from '../device/JsWallet'
import CoreWallet from '../device/CoreWallet'

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
    this._txListener = async (error, txInfo) => {
      if (error !== D.ERROR_NO_ERROR) {
        this._listeners.forEach(listener => listener(error))
        return
      }
      await this._db.saveOrUpdateTxInfo(txInfo)
      let accounts = await this._db.getAccounts({accountId: txInfo.accountId})
      this._listeners.forEach(listener => listener(D.ERROR_NO_ERROR, txInfo, accounts[0]))
    }

    /**
     * handle when new transaction comes:
     * 1. store/update new txInfo after filling "isMine" and "value" field
     * 2. store utxo, addressInfo, txInfo
     */
    let busy = false
    this._addressListener = async (error, addressInfo, txInfo, utxos) => {
      // eslint-disable-next-line
      while (busy) {
        await D.wait(5)
      }
      busy = true
      try {
        if (error !== D.ERROR_NO_ERROR) {
          this._listeners.forEach(listener => listener(error, txInfo))
          return
        }
        let addressInfos = await this._db.getAddressInfos({accountId: addressInfo.accountId})
        txInfo.inputs.forEach(input => { input['isMine'] = addressInfos.some(a => a.address === input.prevAddress) })
        txInfo.outputs.forEach(output => { output['isMine'] = addressInfos.some(a => a.address === output.address) })
        txInfo.value = 0
        txInfo.value -= txInfo.inputs.reduce((sum, input) => sum + input.isMine ? input.value : 0, 0)
        txInfo.value += txInfo.outputs.reduce((sum, output) => sum + output.isMine ? output.value : 0, 0)

        // update account balance
        let accounts = await this._db.getAccounts({accountId: addressInfo.accountId})
        let account = accounts[0]
        account.balance += txInfo.value

        // update and addressIndex and listen new address
        let addressPath = D.parseBip44Path(addressInfo.path)
        let newIndex = addressPath.addressIndex + 1
        let addresses = []
        let parentPublicKey = addressPath.isExternal ? account.externalPublicKey : account.changePublicKey
        let oldIndex = addressPath.isExternal ? account.externalPublicKeyIndex : account.changePublicKeyIndex
        let parentPath = D.makeBip44Path(account.coinType, account.index, addressPath.isExternal)
        let type = addressPath.isExternal ? D.ADDRESS_EXTERNAL : D.ADDRESS_CHANGE
        await Promise.all(Array.from({length: newIndex - oldIndex},
          (v, k) => oldIndex + k)
          .map(async i => {
            let address = await this._device.getAddress(i, parentPublicKey)
            addresses.push({
              address: address,
              accountId: account.accountId,
              coinType: account.coinType,
              path: parentPath + '/' + i,
              type: type,
              txCount: 0,
              balance: 0,
              txs: []
            })
          }))
        console.info('account index update', account, 'external', addressPath.isExternal, 'new index', account.externalPublicKeyIndex, 'new address', addresses)
        await Promise.all(addresses.map(address => this._db.saveOrUpdateAddressInfo(address)))
        // listen new addresses
        this._network[account.coinType].listenAddresses(addresses.slice(oldIndex, newIndex), this._addressListener)
        addressPath.isExternal ? account.externalPublicKeyIndex = newIndex : account.changePublicKeyIndex = newIndex
        await this._device.updateIndex(account)

        // check utxo update. unspent can update to pending and spent, pending can update to spent. otherwise ignore
        let oldUtxos = await this._db.getUtxos({accountId: account.accountId})
        utxos.filter(utxo => {
          let oldUtxo = oldUtxos.find(oldUtxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index)
          if (!oldUtxo) return true
          if (oldUtxo.spent === D.TX_UNSPENT) return true
          if (oldUtxo.spent === D.TX_SPENT_PENDING) return utxo === D.TX_SPENT
          return false
        })

        await this._db.newTx(account, addressInfo, txInfo, utxos)
        this._listeners.forEach(listener => listener(D.ERROR_NO_ERROR, txInfo, account))
      } catch (e) {
        console.warn('error in address listener', e)
        this._listeners.forEach(listener => listener(e))
      }
      busy = false
    }
  }

  async init (info) {
    try {
      // TODO real with dependenices between device, coin data and wallet
      if (this._initialized) return
      this._db = new IndexedDB(info.walletId)
      let initList = []
      initList.push(this._db.init())
      initList.push(...Object.values(this._network).map(network => network.init()))
      await Promise.all(initList)
      this._initialized = true
    } catch (e) {
      console.info(e)
      throw D.ERROR_UNKNOWN
    }
  }

  async sync () {
    // TODO judge is new app, whether need recover wallet, recover multiple account
    // TODO some block may forked and became orphan in the future, some tx and utxo will be invalid
    let accounts = await this._db.getAccounts()
    if (accounts.length === 0) {
      console.info('no accounts, init the first account')
      // initialize first account
      let firstAccount = await this.newAccount(D.TEST_MODE ? D.COIN_BIT_COIN_TEST : D.COIN_BIT_COIN)
      if (D.TEST_DATA) {
        firstAccount.balance = 32000000
        await this._db.newAccount(firstAccount)
        console.info('TEST_DATA add test txInfo')
        await this.initTestDbData(firstAccount.accountId)
      }
    }
    await this._device.sync()
    await Promise.all(Object.entries(this._network).map(async ([coinType, network]) => {
      // TODO ??? oneTime
      let addressInfos = await this._db.getAddressInfos({coinType: coinType, type: D.ADDRESS_EXTERNAL})
      network.listenAddresses(addressInfos, this._addressListener)
    }))
    let txInfos = await this._db.getTxInfos()
    txInfos.filter(txInfos => txInfos.confirmations < 6)
      .map(txInfo => async () => this._network[txInfo.coinType].listenTx(txInfo, this._txListener))
  }

  async release () {
    this._listeners = []
    await Promise.all(Object.values(this._network).map(network => network.release()))
    if (this._db) await this._db.release()
  }

  async getAccounts (filter = {}) {
    let accounts = await this._db.getAccounts(filter)
    return accounts.map(account => new EsAccount(account))
  }

  async newAccount (coinType) {
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

    let newAccount = async () => {
      let makeId = function () {
        let text = ''
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        for (let i = 0; i < 32; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length))
        }
        return text
      }

      let newAccount = {
        accountId: makeId(),
        label: 'Account#' + (accountIndex + 1),
        coinType: coinType,
        index: accountIndex,
        balance: 0
      }
      let externalPath = D.makeBip44Path(coinType, accountIndex, true)
      let changePath = D.makeBip44Path(coinType, accountIndex, false)
      newAccount.externalPublicKey = await this._device.getPublicKey(externalPath)
      newAccount.externalPublicKeyIndex = 0
      newAccount.changePublicKey = await this._device.getPublicKey(changePath)
      newAccount.changePublicKeyIndex = 0
      let addresses = []
      await Promise.all(Array.from({length: 20}, (v, k) => k)
        .map(async (k) => {
          let externalAddress = await this._device.getAddress(k, newAccount.externalPublicKey)
          addresses.push({
            address: externalAddress,
            accountId: newAccount.accountId,
            coinType: coinType,
            path: externalPath + '/' + k,
            type: D.ADDRESS_EXTERNAL,
            txCount: 0,
            balance: 0,
            txs: []
          })
          let changeAddress = await this._device.getAddress(k, newAccount.changePublicKey)
          addresses.push({
            address: changeAddress,
            accountId: newAccount.accountId,
            coinType: coinType,
            path: changePath + '/' + k,
            type: D.ADDRESS_CHANGE,
            txCount: 0,
            balance: 0,
            txs: []
          })
        }))
      console.info('newAccount', newAccount, 'addresses', addresses)
      await this._db.newAccount(newAccount, addresses)
    }

    if (lastAccount === null) {
      return newAccount()
    }
    let [total] = await this._db.getTxInfos(
      {
        accountId: lastAccount.accountId,
        startIndex: 0,
        endIndex: 1
      })
    if (total === 0) {
      throw D.ERROR_LAST_ACCOUNT_NO_TRANSACTION
    }
    return newAccount()
  }

  async sendTx (account, utxos, txInfo, rawTx) {
    let coinType = txInfo.coinType
    await this._network[coinType].sendTx(rawTx)
    await this._db.saveOrUpdateTxInfo(txInfo)
    this._network[coinType].listenTx(txInfo, this._txListener)
    // TODO ??? newTx?
    this._db.newTx(account, null, txInfo, utxos)
    this._listeners.forEach(listener => listener.callback(D.ERROR_NO_ERROR, txInfo, account))
  }

  getTxInfos (filter) {
    return this._db.getTxInfos(filter)
  }

  getUtxos (filter) {
    return this._db.getUtxos(filter)
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
  async initTestDbData (accountId) {
    console.info('initTestDbData')
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
