
const D = require('../D').class
const IndexedDB = require('./database/IndexedDB').class
const BlockChainInfo = require('./network/BlockChainInfo').class
const EsAccount = require('../EsAccount').class

const CoinData = function () {
  this._initialized = false
  this._device = D.TEST_JS_WALLET ? require('../device/JsWallet').instance : require('../device/CoreWallet').instance
  // TODO read provider from settings
  this._networkProvider = BlockChainInfo
  this._network = {}
  this._network[D.COIN_BIT_COIN] = new this._networkProvider()
  this._network[D.COIN_BIT_COIN_TEST] = new this._networkProvider()

  this._listeners = []
  this._txListener = (error, txInfo) => {
    if (error !== D.ERROR_NO_ERROR) {
      return
    }
    this._db.saveOrUpdateTxInfo(txInfo, (error) => {
      if (error !== D.ERROR_NO_ERROR) return
      for (let listener of this._listeners) {
        listener(txInfo)
      }
    })
  }

  /**
   * handle when new transaction comes:
   * 1. store/update new txInfo after filling "isMine" and "value" field
   * 2. store utxo, addressInfo, txInfo
   */
  let busy = false
  this._addressListener = async function (error, addressInfo, txInfo, utxo) {
    // eslint-disable-next-line
    while (busy) {
      await D.wait(100)
    }
    busy = true
    if (error !== D.ERROR_NO_ERROR) return
    let addressInfos = await this._db.getAddressInfos({accountId: addressInfo.accountId})
    txInfo.inputs.forEach(input => { input['isMine'] = addressInfos.some(a => a.address === addressInfo.address) })
    txInfo.outputs.forEach(output => { output['isMine'] = addressInfos.some(a => a.address === addressInfo.address) })
    txInfo.value -= txInfo.inputs.reduce((sum, input) => sum + input.isMine ? input.value : 0)
    txInfo.value += txInfo.outputs.reduce((sum, output) => sum + output.isMine ? output.value : 0)
    await this._db.newTx(addressInfo, txInfo, utxo)
    for (let listener of this._listeners) {
      listener(txInfo)
    }
    await this._device.updateIndex(addressInfo)
    busy = false
  }
}
module.exports = {instance: new CoinData()}

CoinData.prototype.init = async function (info) {
  if (this._initialized) return
  this._db = new IndexedDB(info.walletId)
  await this._db.init()
  await Promise.all(Object.entries(this._network).map(([coinType, network]) => network.init(coinType)))

  let accounts = await this._db.getAccounts()
  if (accounts.length === 0) {
    console.log('no accounts, init the first account')
    // initialize first account
    let firstAccount = await this.newAccount(D.TEST_MODE ? D.COIN_BIT_COIN_TEST : D.COIN_BIT_COIN)
    if (D.TEST_DATA) {
      firstAccount.balance = 32000000
      await this._db.saveAccount(firstAccount)
      console.log('TEST_DATA add test txInfo')
      await this.initTestDbData(firstAccount.accountId)
    }
  }
  this._initialized = true
}

CoinData.prototype.sync = async function () {
  await this._device.sync()
  await Promise.all(Object.entries(this._network).map(([coinType, network]) => async () => {
    let addressInfos = await this._db.getAddressInfos({coinType: coinType, type: D.ADDRESS_EXTERNAL})
    network.listenAddresses(addressInfos, this._addressListener)
  }))
  let txInfos = await this._db.getTxInfos()
  txInfos.filter(txInfos => txInfos.confirmations < 6)
    .map(txInfo => async () => this._network[txInfo.coinType].listenTx(txInfo, this._txListener))
}

CoinData.prototype.release = async function () {
  this._listeners = []
  await Promise.all(Object.values(this._network).map(network => network.release()))
  if (this._db) await this._db.release()
}

CoinData.prototype.getAccounts = async function (filter = {}) {
  let accounts = await this._db.getAccounts(filter)
  return accounts.map(account => new EsAccount(account))
}

CoinData.prototype.newAccount = async function (coinType) {
  let accounts = await this._db.getAccounts()

  // check whether the last spec coinType account has transaction
  let lastAccount = null
  let count = 0
  for (let account of accounts) {
    if (account.coinType === coinType) {
      lastAccount = account
      count++
    }
  }
  let index = count + 1

  let newAccount = async () => {
    // TODO get account public key from device, and generate first 20 address
    let newAccount = {
      accountId: makeId(),
      label: 'Account#' + index,
      coinType: coinType,
      balance: 0
    }
    newAccount.extendPublicKey = this._device.getPublicKey("m/44'/" + D.getCoinIndex(coinType) + "'/0/0")
    newAccount.extendPublicKeyIndex = 0
    newAccount.changePublicKey = this._device.getPublicKey("m/44'/" + D.getCoinIndex(coinType) + "'/1/0")
    newAccount.changePublicKeyIndex = 0
    let extendAddresses = Array.from({length: newAccount.extendPublicKeyIndex + 20}, (v, k) => k).map()

    return this._db.saveAccount(newAccount)
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

CoinData.prototype.getTxInfos = function (filter) {
  return this._db.getTxInfos(filter)
}

CoinData.prototype.getFloatFee = function (coinType, fee) {
  return D.getFloatFee(coinType, fee)
}

CoinData.prototype.addListener = function (callback) {
  let exists = this._listeners.some(listener => listener === callback)
  if (exists) {
    console.log('addTransactionListener already has this listener', callback)
    return
  }
  this._listeners.push(callback)
}

/*
 * Test data when TEST_DATA=true
 */
CoinData.prototype.initTestDbData = async function (accountId) {
  console.log('initTestDbData')
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
        txCount: 0,
        balance: 0,
        txIds: []
      })
  ])
}

function makeId () {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
