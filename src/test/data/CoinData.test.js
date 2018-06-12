
import chai from 'chai'
import D from '../../sdk/D'
import CoinData from '../../sdk/data/CoinData'
import IndexedDB from '../../sdk/data/database/IndexedDB'
import JsWallet from '../../sdk/device/JsWallet'

chai.should()
describe('CoinData', function () {
  this.timeout(100000)
  let coinData = new CoinData()

  it('clearDatabase', async () => {
    let indexedDB = new IndexedDB(D.test.syncWalletId)
    await indexedDB.init()
    await indexedDB.clearDatabase()
  })

  it('init', async () => {
    let info = await new JsWallet().init()
    await coinData.init(info)
  })
  it('init again', async () => {
    await coinData.init({walletId: D.test.syncWalletId})
  })
  it('init again again', async () => {
    await coinData.init({walletId: D.test.syncWalletId})
  })

  // it('sync', async () => {
  //   coinData.addListener((error, txInfo) => {
  //     console.log('detect new tx', error, txInfo)
  //   })
  //   await coinData.sync()
  // })

  //
  // let account1
  // it('getAccounts', async () => {
  //   let accounts = await coinData.getAccounts()
  //   accounts.length.should.equal(1)
  //   let account = accounts[0]
  //   account1 = account
  //   account.should.not.equal(undefined)
  //   account.label.should.equal('Account#1')
  //   if (D.test.data) {
  //     account.balance.should.equal(32000000)
  //   } else {
  //     account.balance.should.equal(0)
  //   }
  // })
  //
  // let account2
  // it('newAccount', async () => {
  //   if (D.test.data) {
  //     let account = await coinData.newAccount(D.coin.main.btc)
  //     account2 = account
  //     account.should.not.equal(undefined)
  //     account.label.should.equal('Account#2')
  //     account.balance.should.equal(0)
  //   } else {
  //     let error = D.error.succeed
  //     try {
  //       await coinData.newAccount(D.coin.main.btc)
  //     } catch (e) {
  //       error = e
  //     }
  //     error.should.equal(D.error.lastAccountNoTransaction)
  //   }
  // })
  // it('newAccount again', async () => {
  //   let error = D.error.succeed
  //   try {
  //     await coinData.newAccount(D.coin.main.btc)
  //   } catch (e) {
  //     error = e
  //   }
  //   error.should.equal(D.error.lastAccountNoTransaction)
  // })
  //
  // it('getTxInfos', async () => {
  //   let [total, transactions] = await coinData.getTxInfos({accountId: account1.accountId})
  //   if (D.test.data) {
  //     total.should.equal(3)
  //     let accountId = account1.accountId
  //     transactions[0].should.deep.equal({
  //       accountId: accountId,
  //       coinType: D.coin.main.btc,
  //       txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
  //       direction: D.tx.direction.in,
  //       address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
  //       time: 1524138384000,
  //       outIndex: 0,
  //       script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
  //       value: 84000000,
  //       hasDetails: false
  //     })
  //     transactions[1].should.deep.equal({
  //       accountId: accountId,
  //       coinType: D.coin.main.btc,
  //       txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
  //       direction: D.tx.direction.out,
  //       address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
  //       time: 1524138384000,
  //       value: 18000000,
  //       hasDetails: false
  //     })
  //     transactions[2].should.deep.equal({
  //       accountId: accountId,
  //       coinType: D.coin.main.btc,
  //       txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
  //       address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
  //       time: 1524138384000,
  //       direction: D.tx.direction.out,
  //       value: 34000000,
  //       hasDetails: false
  //     })
  //   } else {
  //     total.should.equal(0)
  //     transactions.length.should.equal(0)
  //   }
  //   if (D.test.data) {
  //     let [total, transactions] = await coinData.getTxInfos({accountId: account2.accountId})
  //     total.should.equal(0)
  //     transactions.length.should.equal(0)
  //   }
  // })
  //
  // it('getFloatFee', () => {
  //   coinData.getFloatFee(D.coin.main.btc, 800000000).should.equal(8)
  //   coinData.getFloatFee(D.coin.main.btc, 100).should.equal(0.000001)
  //   coinData.getFloatFee(D.coin.main.btc, 283750234).should.equal(2.83750234)
  //   coinData.getFloatFee(D.coin.test.btcTestNet3, 283750234).should.equal(2.83750234)
  //   let error = D.error.succeed
  //   try {
  //     coinData.getFloatFee('other coin', 1000)
  //   } catch (e) {
  //     error = e
  //   }
  //   error.should.equal(D.error.coinNotSupported)
  // })
  //
  it('release', async () => {
    await coinData.release()
  })
})
