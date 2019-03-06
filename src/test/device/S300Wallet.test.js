
import D from '../../sdk/D'
import Provider from '../../sdk/Provider'
import S300Wallet from '../../sdk/device/implements/S300Wallet'
import ChromeUsbDevice from '../../sdk/device/implements/transmitter/io/ChromeUsbDevice'
import bitPony from 'bitpony'
import chai from 'chai'
import CcidTransmitter from '../../sdk/device/implements/transmitter/CcidTransmitter'

Provider.HardDevice = ChromeUsbDevice

chai.should()
describe('S300Wallet', function () {
  let s300Wallet
  this.timeout(600000)

  before(function (done) {
    let transmitter = new CcidTransmitter()
    transmitter.listenPlug((error, status) => {
      error.should.equal(D.error.succeed)
      if (status === D.status.plugIn) {
        s300Wallet = new S300Wallet(transmitter)
        s300Wallet.init().then(() => done())
      }
    })
  })

  it('get address', async () => {
    let address = await s300Wallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/1/0", false)
    D.address.checkBtcAddress(D.coin.main.btc, address)
  })

  it('get address by apdu', async () => {
    let address = await s300Wallet.sendApdu('8046000715058000002c80000000800000000000000000000000', true)
    address = String.fromCharCode.apply(null, new Uint8Array(address))
    D.address.checkBtcAddress(D.coin.main.btc, address)
  })

  it('sign by apdu', async () => {
    let response = await s300Wallet.sendApdu((
      '80480300ec' +
      'c0 058000002c8000000080000000000000010000004c' +
      'c1 058000002c80000000800000000000000100000047' +
      'c2 00bd' +
      '01000000' +
      '02 1492e4929029fdcbeab72d37006033eb2de1347207d116c2b73c07180fe7da02 01000000 1976a9147ffc6a7703a711f970ba704e5c3dd1b45db7392388ac ffffffff' +
      '   4e4884d6c5f6fcbc62b43dbeddbac32bf5b00b943ed619cffcfd0c5952536cc1 01000000 00 ffffffff' +
      '02 00e1f50500000000 1976a9140db798fb2450a5225bd3ac8805df8104caf3deef88ac' +
      '   2ab6310000000000 1976a914c66ca0d5afb30f1b44e94acbfa9c6f5d3f7c2efd88ac' +
      '00000000' +
      '01000000').replace(/ /g, ''), true)
    console.log('sign by apdu', response.toString('hex'))
    response.should.not.equal(undefined)

    response = await s300Wallet.sendApdu((
      '80480300ec' +
      'c0 058000002c8000000080000000000000010000004c' +
      'c1 058000002c80000000800000000000000100000047' +
      'c2 00bd' +
      '01000000' +
      '02 1492e4929029fdcbeab72d37006033eb2de1347207d116c2b73c07180fe7da02 01000000 00 ffffffff' +
      '   4e4884d6c5f6fcbc62b43dbeddbac32bf5b00b943ed619cffcfd0c5952536cc1 01000000 1976a9147ffc6a7703a711f970ba704e5c3dd1b45db7392388ac ffffffff' +
      '02 00e1f50500000000 1976a9140db798fb2450a5225bd3ac8805df8104caf3deef88ac' +
      '   2ab6310000000000 1976a914c66ca0d5afb30f1b44e94acbfa9c6f5d3f7c2efd88ac' +
      '00000000' +
      '01000000').replace(/ /g, ''), true)
    console.log('sign by apdu', response.toString('hex'))
    response.should.not.equal(undefined)
  })

  it('sign bitcoin', async () => {
    let changeAddress = await s300Wallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/1/0", false)
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
    let result = await s300Wallet.signTransaction(D.coin.main.btc, tx)
    console.log(result, bitPony.tx.read(result.hex))
  })
})
