
import EsWallet from '../sdk/EsWallet'
import D from '../sdk/D'
require('chai').should()

// const esWallet = EsWallet.getInstance()
D.TEST_SYNC = true
describe('EsWallet', function () {
  this.timeout(5000)

  // it('delete database', async () => {
  //   let IndexedDB = require('../sdk/data/database/IndexedDB').class
  //   let indexedDB = new IndexedDB(D.TEST_WALLET_ID)
  //   await indexedDB.deleteDatabase()
  // })

  // FIXME why still has new tx without deleting database?
  // it('listenStatus', (done) => {
  //   const statusList = [D.STATUS_PLUG_IN, D.STATUS_INITIALIZING, D.STATUS_SYNCING, D.STATUS_SYNC_FINISH]
  //   let currentStatusIndex = 0
  //
  //   esWallet.listenTxInfo((error, txInfo) => {
  //     console.log('detect new tx', error, txInfo)
  //   })
  //   esWallet.listenStatus((error, status) => {
  //     console.log('error, status', error, status)
  //     error.should.equal(D.ERROR_NO_ERROR)
  //     status.should.equal(statusList[currentStatusIndex])
  //     currentStatusIndex++
  //     if (currentStatusIndex === statusList.length) {
  //       done()
  //     }
  //   })
  // })
  //
  // it('getAccounts', async () => {
  //   let accounts = await esWallet.getAccounts()
  //   accounts.length.should.equal(1)
  // })
  //
  // it('newAccounts', async () => {
  //   // TODO test after finish sync
  // })
  //
  // it('getWalletInfo', async () => {
  //   let info = esWallet.getWalletInfo()
  //   info.should.not.equal(undefined)
  // })

  it('sign', () => {
    let a = new EsWallet()
    let b = new EsWallet()
    console.log(a)
    console.log(b)
    console.log(a === b)
  })
})
