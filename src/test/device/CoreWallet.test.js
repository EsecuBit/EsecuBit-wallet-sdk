
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import chai from 'chai'

chai.should()
describe('CoreWallet', function () {
  const coreWallet = new CoreWallet()

  it('listenPlug', function (done) {
    this.timeout(5000)
    coreWallet.listenPlug((error, status) => {
      error.should.equal(D.error.succeed)
      if (status === D.status.plugIn) {
        done()
      }
    })
  })

  it('get random', async () => {
    let response = await coreWallet.getRandom(8)
    response.byteLength.should.equal(8)
  })
})
