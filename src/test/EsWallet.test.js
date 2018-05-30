
import chai from 'chai'
import EsWallet from '../sdk/EsWallet'
import D from '../sdk/D'
import IndexedDB from '../sdk/data/database/IndexedDB'

chai.should()
describe('EsWallet', function () {
  this.timeout(30000)
  let esWallet = null

  it('clearDatabase', async () => {
    let indexedDB = new IndexedDB(D.TEST_WALLET_ID)
    await indexedDB.init()
    await indexedDB.clearDatabase()
  })

  // new EsWallet will have heavy work, so do the lazy work
  it('new wallet', async () => {
    esWallet = new EsWallet()
  })

  // FIXME why still has new tx without deleting database?
  it('listenStatus', (done) => {
    const statusList = [D.STATUS_PLUG_IN, D.STATUS_INITIALIZING, D.STATUS_SYNCING, D.STATUS_SYNC_FINISH]
    let currentStatusIndex = 0

    esWallet.listenTxInfo((error, txInfo) => {
      console.info('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.info('error, status', error, status)
      error.should.equal(D.ERROR_NO_ERROR)
      status.should.equal(statusList[currentStatusIndex])
      currentStatusIndex++
      if (currentStatusIndex === statusList.length) {
        done()
      }
    })
  })

  it('getAccounts', async () => {
    let accounts = await esWallet.getAccounts()
    accounts.length.should.equal(1)
  })

  it('newAccounts', async () => {
    // TODO test after finish sync
  })

  it('getWalletInfo', async () => {
    let info = esWallet.getWalletInfo()
    info.should.not.equal(undefined)
  })
})
