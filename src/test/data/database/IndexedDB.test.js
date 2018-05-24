
const D = require('../../../sdk/D').class
const IndexedDB = require('../../../sdk/data/database/IndexedDB').class
require('chai').should()

const deviceId = 'default'
const passPhraseId = 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548'
const indexedDB = new IndexedDB()

describe('IndexedDB', function () {
  it('delete database', async () => {
    await indexedDB.deleteDatabase()
  })

  it('init', async () => {
    await indexedDB.init()
  })

  it('getAccounts', async () => {
    let accounts = await indexedDB.getAccounts(deviceId, passPhraseId)
    accounts.length.should.equal(0)
  })

  let account1
  it('saveAccount1', async () => {
    account1 = {
      accountId: '123',
      label: 'Account#1',
      deviceId: deviceId,
      passPhraseId: passPhraseId,
      coinType: D.COIN_BIT_COIN,
      balance: 0
    }
    let account = await indexedDB.saveAccount(account1)
    account.should.deep.equal(account1)

    let accounts = await indexedDB.getAccounts(deviceId, passPhraseId)
    accounts.should.deep.equal([account1])
  })

  it('saveAccount2WithSameId', async () => {
    let error = D.ERROR_NO_ERROR
    try {
      let account1 = {
        accountId: '123',
        label: 'Account#2',
        deviceId: deviceId,
        passPhraseId: passPhraseId,
        coinType: D.COIN_BIT_COIN,
        balance: 0
      }
      await indexedDB.saveAccount(account1)
    } catch (e) {
      error = e
    }
    error.should.equal(D.ERROR_DATABASE_EXEC_FAILED)
  })

  it('saveAccount2WithDifferentId', async () => {
    let account2 = {
      accountId: '456',
      label: 'Account#2',
      deviceId: deviceId,
      passPhraseId: passPhraseId,
      coinType: D.COIN_BIT_COIN,
      balance: 0
    }
    let account = await indexedDB.saveAccount(account2)
    account.should.deep.equal(account2)

    let accounts = await indexedDB.getAccounts(deviceId, passPhraseId)
    accounts.should.deep.equal([account1, account2])
  })

  it('getTxInfos', async () => {
    let [total] = await indexedDB.getTxInfos({accountId: account1.accountId})
    total.should.equal(0)
  })

  let txInfo
  it('saveOrUpdateTxInfo', async () => {
    txInfo = {
      accountId: account1.accountId,
      coinType: account1.coinType,
      txId: '111',
      version: 1,
      blockNumber: 10000,
      confirmations: 100,
      lockTime: 0,
      time: 222,
      direction: D.TX_DIRECTION_IN,
      inputs: [{
        prevAddress: 'aaa',
        isMine: false,
        value: 766
      }],
      outputs: [{
        address: 'bbb',
        isMine: true,
        value: 666
      }],
      value: 666
    }
    let txInfo2 = await indexedDB.saveOrUpdateTxInfo(txInfo)
    txInfo2.should.deep.equal(txInfo)

    let [total, txs] = await indexedDB.getTxInfos({accountId: account1.accountId})
    total.should.equal(1)
    txs.length.should.equal(1)
    txs[0].should.deep.equal(txInfo)
  })

  it('updateTxInfos', async () => {
    txInfo.inputs[0].isMine = true
    txInfo.value -= txInfo.inputs[0].value
    let txInfo2 = await indexedDB.saveOrUpdateTxInfo(txInfo)
    txInfo2.should.deep.equal(txInfo)

    let [total, txs] = await indexedDB.getTxInfos({accountId: account1.accountId})
    total.should.equal(1)
    txs.length.should.equal(1)
    txs[0].should.deep.equal(txInfo)
  })
})
