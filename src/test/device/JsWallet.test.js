
require('chai').should()
const wallet = require('../../sdk/device/JsWallet').instance

describe('JsWallet', function () {
  this.timeout('10000')

  it('init', async () => {
    await wallet.init()
  })

  it('getAddress', async () => {
    let address = await wallet.getAddress("m/44'/0'/0'/0/0")
    address.should.equal('mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR')
  })

  it('signTransaction', async () => {
    let response = await wallet.signTransaction({
      inputs: [{
        prevAddress: 'mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR',
        prevAddressPath: "m/44'/0'/0'/0/0",
        prevTxId: '61d520ccb74288c96bc1a2b20ea1c0d5a704776dd0164a396efec3ea7040349d',
        prevOutIndex: 0
      }],
      outputs: [{
        address: 'mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR',
        value: 12000
      }]
    })
    response.should.deep.equal({
      id: '181a83c3b690265173f2af32d6922d1ac32d6b24f82235861686bd90a1b2560d',
      hex: '01000000019d344070eac3fe6e394a16d06d7704a7d5c0a10eb2a2c16bc98842b7cc20d561000000006b483045022100f13343e9ddf2786c043c2c59469db21c872b29879cfba58bdfd4ddc407a3486302200436bd82925d19acfe6c10e342713e5b4fbf26be69b4af74e3f0fd8dbf323ef8012102524af713c5a64f26a1a7ccf1d752146e4c8cbaea08ef0848fe3dc80961747245ffffffff01e02e0000000000001976a914d2ee0dda3473302abe5c9c315a6da0581d543a9888ac00000000'
    })
  })

  it('derivePublicKey', async () => {
    let publicKey5 = await wallet.getPublicKey("m/44'/0'/0'/0/100")
    let publicKey4 = await wallet.getPublicKey("m/44'/0'/0'/0")
    let publicKey4to5 = await wallet.getPublicKey('100', publicKey4)
    publicKey5.should.deep.equal(publicKey4to5)
  })

  it('deriveAddress', async () => {
    let address5 = await wallet.getAddress("m/44'/0'/0'/0/100")
    let publicKey4 = await wallet.getPublicKey("m/44'/0'/0'/0")
    let address4to5 = await wallet.getAddress('100', publicKey4)
    address5.should.deep.equal(address4to5)
  })
})
