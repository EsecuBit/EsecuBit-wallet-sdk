
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import chai from 'chai'

chai.should()
describe('CoreWallet', function () {
  let coreWallet
  this.timeout(100000)

  it('init', () => {
    D.test.mockDevice = false
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

  it('getRandom', async () => {
    let response = await coreWallet.getRandom(8)
    response.byteLength.should.equal(8)
  })

  it('getRandom by enc apdu', async () => {
    let response = await coreWallet._sendApdu('0084000008', true)
    response.byteLength.should.equal(8)
  })

  it('get address by apdu', async () => {
    let address = await coreWallet._sendApdu('803D000415 05 8000002C 80000000 80000000 00000000 00000000', false)
    address = String.fromCharCode.apply(null, new Uint8Array(address))
    D.address.checkBtcAddress(address)
  })

  it('get address', async () => {
    let address = await coreWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")
    D.address.checkBtcAddress(address)
  })
})
