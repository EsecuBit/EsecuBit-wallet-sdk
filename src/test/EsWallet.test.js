
const Wallet = require('../sdk/EsWallet').class
const D = require('../sdk/D').class

const wallet = new Wallet()

// TODO test
describe('EsWallet', function () {
  this.timeout(100000)

  it('delete database', async () => {
    let IndexedDB = require('../sdk/data/database/IndexedDB').class
    let indexedDB = new IndexedDB(D.TEST_WALLET_ID)
    await indexedDB.deleteDatabase()
  })

  it('listenStatus', (done) => {
    const statusList = [D.STATUS_PLUG_IN, D.STATUS_INITIALIZING, D.STATUS_SYNCING, D.STATUS_SYNC_FINISH]
    let currentStatusIndex = 0

    wallet.listenTxInfo((error, txInfo) => {
      console.log('detect new tx', error, txInfo)
    })
    wallet.listenStatus((error, status) => {
      console.log('status', status)
      error.should.equal(D.ERROR_NO_ERROR)
      status.should.equal(statusList[currentStatusIndex])
      currentStatusIndex++
      if (currentStatusIndex === statusList.length) {
        done()
      }
    })
  })

  it('getAccounts', async () => {
    let accounts = await wallet.getAccounts()
    accounts.length.should.equal(1)
  })

  it('newAccounts', async () => {
    // TODO test after finish sync
  })

  it('getWalletInfo', async () => {
    let info = wallet.getWalletInfo()
    info.should.not.equal(undefined)
  })
})
