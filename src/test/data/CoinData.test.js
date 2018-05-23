
const D = require('../../sdk/D').class
const coinData = require('../../sdk/data/CoinData').instance
require('chai').should()

const deviceId = 'default'
const passPhraseId = 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548'

describe('CoinData', function () {
  it('delete database', async () => {
    if (!('indexedDB' in window)) {
      console.warn('no indexedDB implementation')
      throw D.ERROR_DATABASE_OPEN_FAILED
    }

    await new Promise((resolve, reject) => {
      let deleteRequest = indexedDB.deleteDatabase('wallet')
      deleteRequest.onsuccess = function () {
        console.log('indexedDB delete succeed')
        resolve()
      }
      deleteRequest.onerror = function (ev) {
        console.log('indexedDB delete failed', ev)
        reject(D.ERROR_DATABASE_OPEN_FAILED)
      }
    })
  })

  it('init', async () => {
    await coinData.init()
  })
  it('init again', async () => {
    await coinData.init()
  })
  it('init again again', async () => {
    await coinData.init()
  })

  let account1
  it('getAccounts', async () => {
    let accounts = await coinData.getAccounts(deviceId, passPhraseId)
    accounts.length.should.equal(1)
    let account = accounts[0]
    account1 = account
    account.should.not.equal(undefined)
    account.deviceId.should.equal(deviceId)
    account.passPhraseId.should.equal(passPhraseId)
    account.label.should.equal('Account#1')
    if (D.TEST_DATA) {
      account.balance.should.equal(32000000)
    } else {
      account.balance.should.equal(0)
    }
  })

  let account2
  it('newAccount', async () => {
    if (D.TEST_DATA) {
      let account = await coinData.newAccount(deviceId, passPhraseId, D.COIN_BIT_COIN)
      account2 = account
      account.should.not.equal(undefined)
      account.deviceId.should.equal(deviceId)
      account.passPhraseId.should.equal(passPhraseId)
      account.label.should.equal('Account#2')
      account.balance.should.equal(0)
    } else {
      let error = D.ERROR_NO_ERROR
      try {
        await coinData.newAccount(deviceId, passPhraseId, D.COIN_BIT_COIN)
      } catch (e) {
        error = e
      }
      error.should.equal(D.ERROR_LAST_ACCOUNT_NO_TRANSACTION)
    }
  })
  it('newAccount again', async () => {
    let error = D.ERROR_NO_ERROR
    try {
      await coinData.newAccount(deviceId, passPhraseId, D.COIN_BIT_COIN)
    } catch (e) {
      error = e
    }
    error.should.equal(D.ERROR_LAST_ACCOUNT_NO_TRANSACTION)
  })

  it('getTxInfos', async () => {
    let [total, transactions] = await coinData.getTxInfos({accountId: account1.accountId})
    if (D.TEST_DATA) {
      total.should.equal(3)
      let accountId = account1.accountId
      transactions[0].should.deep.equal({
        accountId: accountId,
        coinType: D.COIN_BIT_COIN,
        txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
        direction: D.TX_DIRECTION_IN,
        address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
        time: 1524138384000,
        outIndex: 0,
        script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
        value: 84000000,
        hasDetails: false
      })
      transactions[1].should.deep.equal({
        accountId: accountId,
        coinType: D.COIN_BIT_COIN,
        txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
        direction: D.TX_DIRECTION_OUT,
        address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
        time: 1524138384000,
        value: 18000000,
        hasDetails: false
      })
      transactions[2].should.deep.equal({
        accountId: accountId,
        coinType: D.COIN_BIT_COIN,
        txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
        address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
        time: 1524138384000,
        direction: D.TX_DIRECTION_OUT,
        value: 34000000,
        hasDetails: false
      })
    } else {
      total.should.equal(0)
      transactions.length.should.equal(0)
    }
    if (D.TEST_DATA) {
      let [total, transactions] = await coinData.getTxInfos({accountId: account2.accountId})
      total.should.equal(0)
      transactions.length.should.equal(0)
    }
  })

  it('getFloatFee', () => {
    coinData.getFloatFee(D.COIN_BIT_COIN, 800000000).should.equal(8)
    coinData.getFloatFee(D.COIN_BIT_COIN, 100).should.equal(0.000001)
    coinData.getFloatFee(D.COIN_BIT_COIN, 283750234).should.equal(2.83750234)
    coinData.getFloatFee(D.COIN_BIT_COIN_TEST, 283750234).should.equal(2.83750234)
    let error = D.ERROR_NO_ERROR
    try {
      coinData.getFloatFee('other coin', 1000)
    } catch (e) {
      error = e
    }
    error.should.equal(D.ERROR_COIN_NOT_SUPPORTED)
  })
})
