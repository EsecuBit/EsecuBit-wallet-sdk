
import chai from 'chai'
import D from '../../../sdk/D'
import IndexedDB from '../../../sdk/data/database/IndexedDB'

chai.should()
const indexedDB = new IndexedDB(D.TEST_WALLET_ID)
describe('IndexedDB', function () {
  let account1 = {
    accountId: '123',
    label: 'Account#1',
    coinType: D.COIN_BIT_COIN,
    balance: 0
  }

  let txInfo = {
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

  let addressInfo = {
    address: txInfo.outputs[0].address,
    accountId: account1.accountId,
    coinType: D.COIN_BIT_COIN,
    path: "m/0'/44'/0'/0/0",
    type: D.ADDRESS_EXTERNAL,
    txCount: 1,
    balance: txInfo.outputs[0].value,
    txIds: [txInfo.txId]
  }

  let utxo = {
    accountId: account1.accountId,
    coinType: account1.coinType,
    address: addressInfo.address,
    path: addressInfo.path,
    txId: txInfo.txId,
    index: txInfo.outputs[0].index,
    script: 'abc',
    value: txInfo.outputs[0].value
  }

  // it('delete database', async () => {
  //   await indexedDB.deleteDatabase()
  // })

  it('init', async () => {
    await indexedDB.init()
  })

  it('clearDatabase', async () => {
    await indexedDB.clearDatabase()
  })

  it('getAccounts', async () => {
    let accounts = await indexedDB.getAccounts()
    accounts.length.should.equal(0)
  })

  it('saveAccount1', async () => {
    let account = await indexedDB.newAccount(account1)
    account.should.deep.equal(account1)

    let accounts = await indexedDB.getAccounts()
    accounts.should.deep.equal([account1])
  })

  it('saveAccount2WithSameId', async () => {
    let error = D.ERROR_NO_ERROR
    try {
      let account1 = {
        accountId: '123',
        label: 'Account#2',
        coinType: D.COIN_BIT_COIN,
        balance: 0
      }
      await indexedDB.newAccount(account1)
    } catch (e) {
      error = e
    }
    error.should.equal(D.ERROR_DATABASE_EXEC_FAILED)
  })

  it('saveAccount2WithDifferentId', async () => {
    let account2 = {
      accountId: '456',
      label: 'Account#2',
      coinType: D.COIN_BIT_COIN,
      balance: 0
    }
    let account = await indexedDB.newAccount(account2)
    account.should.deep.equal(account2)

    let accounts = await indexedDB.getAccounts()
    accounts.should.deep.equal([account1, account2])
  })

  it('getTxInfos', async () => {
    let [total] = await indexedDB.getTxInfos({accountId: account1.accountId})
    total.should.equal(0)
  })
  it('saveOrUpdateTxInfo', async () => {
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

  it('getAddressInfos', async () => {
    let addressInfos = await indexedDB.getAddressInfos()
    addressInfos.length.should.equal(0)
  })

  it('saveOrUpdateAddressInfo', async () => {
    let addressInfo2 = await indexedDB.saveOrUpdateAddressInfo(addressInfo)
    addressInfo2.should.deep.equal(addressInfo)

    let addressInfos = await indexedDB.getAddressInfos()
    addressInfos[0].should.deep.equal(addressInfo)
  })

  it('newTx', async () => {
    await indexedDB.newTx(addressInfo, txInfo, utxo)
  })

  // TODO test newTx with invalid utxo or txInfo
})
