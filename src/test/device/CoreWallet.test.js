
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import chai from 'chai'

chai.should()
describe('CoreWallet', function () {
  let coreWallet

  it('init', () => {
    D.test.mockDevice = true
    coreWallet = new CoreWallet()
  })

  it('listenPlug', function (done) {
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
