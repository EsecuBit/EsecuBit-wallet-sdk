
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

  it('getRandom', async () => {
    let response = await coreWallet.getRandom(8)
    response.length.should.equal(8)
  })

  it('getRandom by apdu', async () => {
    let response = await coreWallet._sendApdu('0084000008', true)
    response.length.should.equal(8)
  })

  it('get address by apdu', async () => {
    let address = await coreWallet._sendApdu('803D000415058000002C80000000800000000000000000000000', true)
    address = String.fromCharCode.apply(null, new Uint8Array(address))
    D.address.checkBtcAddress(address)
  })

  it('sign by apdu', async () => {
    await coreWallet._sendApdu('8082008100', true)
    let response = await coreWallet._sendApdu('803d0100000115c0058000002c8000000080000000000000010000004cc1058000002c80000000800000000000000100000047c200e601000000031492e4929029fdcbeab72d37006033eb2de1347207d116c2b73c07180fe7da02010000001976a9147ffc6a7703a711f970ba704e5c3dd1b45db7392388acffffffff4e4884d6c5f6fcbc62b43dbeddbac32bf5b00b943ed619cffcfd0c5952536cc10100000000ffffffff8f9901faf6045d5cf4dd7b8a98e1e18a0428326e5c3236d8bc72fa1af54d7ed50100000000ffffffff0200e1f505000000001976a9140db798fb2450a5225bd3ac8805df8104caf3deef88ac2ab63100000000001976a914c66ca0d5afb30f1b44e94acbfa9c6f5d3f7c2efd88ac0000000001000000', true)
    response.should.not.equal(undefined)
    response = await coreWallet._sendApdu('803d0100000115c0058000002c8000000080000000000000010000004cc1058000002c80000000800000000000000100000047c200e601000000031492e4929029fdcbeab72d37006033eb2de1347207d116c2b73c07180fe7da020100000000ffffffff4e4884d6c5f6fcbc62b43dbeddbac32bf5b00b943ed619cffcfd0c5952536cc1010000001976a9147ffc6a7703a711f970ba704e5c3dd1b45db7392388acffffffff8f9901faf6045d5cf4dd7b8a98e1e18a0428326e5c3236d8bc72fa1af54d7ed50100000000ffffffff0200e1f505000000001976a9140db798fb2450a5225bd3ac8805df8104caf3deef88ac2ab63100000000001976a914c66ca0d5afb30f1b44e94acbfa9c6f5d3f7c2efd88ac0000000001000000', true)
    response.should.not.equal(undefined)
    response = await coreWallet._sendApdu('803d0100000115c0058000002c8000000080000000000000010000004cc1058000002c80000000800000000000000100000047c200e601000000031492e4929029fdcbeab72d37006033eb2de1347207d116c2b73c07180fe7da020100000000ffffffff4e4884d6c5f6fcbc62b43dbeddbac32bf5b00b943ed619cffcfd0c5952536cc10100000000ffffffff8f9901faf6045d5cf4dd7b8a98e1e18a0428326e5c3236d8bc72fa1af54d7ed5010000001976a9147ffc6a7703a711f970ba704e5c3dd1b45db7392388acffffffff0200e1f505000000001976a9140db798fb2450a5225bd3ac8805df8104caf3deef88ac2ab63100000000001976a914c66ca0d5afb30f1b44e94acbfa9c6f5d3f7c2efd88ac0000000001000000', true)
    response.should.not.equal(undefined)
  })

  it('get address', async () => {
    let btcAddr = await coreWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")
    D.address.checkBtcAddress(btcAddr)

    let ethAddr = await coreWallet.getAddress(D.coin.main.eth, "m/44'/60'/0'/0/0")
    console.log('?', btcAddr, ethAddr)
    try {
      D.address.checkEthAddress(ethAddr)
    } catch (e) {
      if (e !== D.error.noAddressCheckSum) throw e
    }
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
