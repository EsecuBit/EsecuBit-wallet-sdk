
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import chai from 'chai'
import bitPony from 'bitpony'

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

  // it('getRandom', async () => {
  //   let response = await coreWallet.getRandom(8)
  //   response.byteLength.should.equal(8)
  // })
  //
  // it('getRandom by enc apdu', async () => {
  //   let response = await coreWallet._sendApdu('0084000008', true)
  //   response.byteLength.should.equal(8)
  // })
  //
  // it('get address by apdu', async () => {
  //   let address = await coreWallet._sendApdu('803D000415 05 8000002C 80000000 80000000 00000000 00000000', true)
  //   address = String.fromCharCode.apply(null, new Uint8Array(address))
  //   D.address.checkBtcAddress(address)
  // })
  //
  // it('get address', async () => {
  //   let address = await coreWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")
  //   D.address.checkBtcAddress(address)

  //   let address = await coreWallet.getAddress(D.coin.main.eth, "m/44'/60'/0'/0/0")
  //   D.address.checkBtcAddress(address)
  // })
  //
  // it('sign eth', async () => {
  //   let result = await coreWallet.signTransaction(D.coin.main.eth, {
  //     input: {
  //       address: '0x1234567890123456789012345678901234567890',
  //       path: "m/44'/60'/0'/0/0"
  //     },
  //     output: {
  //       address: '0x0987654321098765432109876543210987654321',
  //       value: 0.518 * 10000000000000000000
  //     },
  //     nonce: 0,
  //     gasPrice: 1000000000,
  //     startGas: 21000,
  //     data: null
  //   })
  //   console.log('result', result)
  // })

  it('sign bitcoin', async () => {
    let changeAddress = await coreWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/1/0", false)
    console.log('changeAddress', changeAddress)
    let tx = {
      inputs: [{
        address: '1ENJ8LYCcTA69PjkSbGoKjZV5d4r9ieH27',
        path: "m/44'/0'/0'/0/0",
        txId: '476015ca2c1bde00bee951c132526c737f4754eee9defd3f0278d4f0d394bede',
        index: 0,
        script: '76A91492a0aab7ca4d0125ab12fb580bd6ab4f97d9ddfd88AC'
      },
      {
        address: '1NrERKT8iV1GaCwEJtr1GjWfaoCpirWdnk',
        path: "m/44'/0'/0'/0/0",
        txId: '87aa3466539790d6aa30c225c3f408acb16a00135ec93d21ba70bca7d344ecf4',
        index: 2,
        script: '76A91492a0aab7ca4d0125ab12fb580bd6ab4f97d9ddfd88AC'
      }],
      outputs: [{
        address: '1NrERKT8iV1GaCwEJtr1GjWfaoCpirWdnk',
        value: 0.0561 * 10000000
      }, {
        address: '3Hmnj95FwVWUNRx9i4ESbzUvPDAkobgUgw',
        value: 200000000
      }, {
        address: changeAddress,
        value: 100000000
      }],
      changePath: "m/44'/0'/0'/1/0"
    }
    let result = await coreWallet.signTransaction(D.coin.main.btc, tx)
    console.log(result, bitPony.tx.read(result.hex))
  })
})
