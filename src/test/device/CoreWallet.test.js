
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
    let address = await coreWallet._sendApdu('803D000415 05 8000002C 80000000 80000000 00000000 00000000', true)
    address = String.fromCharCode.apply(null, new Uint8Array(address))
    D.address.checkBtcAddress(address)
  })

  it('get address', async () => {
    let address = await coreWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")
    D.address.checkBtcAddress(address)
  })

  it('sign eth', async () => {
    let result = await coreWallet.signTransaction(D.coin.main.eth, {
      input: {
        address: '0x1234567890123456789012345678901234567890',
        path: "m/44'/60'/0'/0/0"
      },
      output: {
        address: '0x0987654321098765432109876543210987654321',
        value: 0.518 * 10000000000000000000
      },
      nonce: 0,
      gasPrice: 1000000000,
      startGas: 21000,
      data: null
    })
    console.log('result', result)
  })

  // it('sign bitcoin', async () => {
  //   let bitpony = require('bitpony')
  //   let response = bitpony.tx.read('01000000026EF5AD344AA895A05638B8EFB710BE731D9E3C88CBDFF2C9A387188BB7761321010000001976A9145572AC9209C6EA1FDC04A2E7BF5C978DD480641688ACFFFFFFFF8dd4f5fbd5e980fc02f35c6ce145935b11e284605bf599a13c6d415db55d07a100000000434104cd5e9726e6afeae357b1806be25a4c3d3811775835d235417ea746b7db9eeab33cf01674b944c64561ce3388fa1abd0fa88b06c44ce81e2234aa70fe578d455dacEEEEEEEE0300719A81860000001976A91493B07B6D8B25040FE98E09493DB4AA95F6DD2AE288AC009F0A53620000001976A9146659770164A47E53B7C098C2CFC86479EF0B7B0088ACA0860100000000001976A914E19170E04D4DEABD036EF45AF2EA72C5BDAD1ADB88AC00000000')
  //   console.log('response', response)
  // })
})
