
const Wallet = require('../sdk/EsWallet').class
const D = require('../sdk/D').class

const coinType = D.COIN_BIT_COIN
const wallet = new Wallet()

// TODO test
describe('EsWallet', function () {
  it('listenStatus', (done) => {
    const statusList = [D.STATUS_PLUG_IN, D.STATUS_INITIALIZING, D.STATUS_SYNCING, D.STATUS_SYNC_FINISH]
    let currentStatusIndex = 0
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
})
