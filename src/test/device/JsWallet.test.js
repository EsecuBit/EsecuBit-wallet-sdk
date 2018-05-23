
require('chai').should()
const wallet = require('../../sdk/device/JsWallet').instance

describe('JsWallet', function () {
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
    response.hex.should.equal('01000000019d344070eac3fe6e394a16d06d7704a7d5c0a10eb2a2c16bc98842b7cc20d561000000006b483045022100f13343e9ddf2786c043c2c59469db21c872b29879cfba58bdfd4ddc407a3486302200436bd82925d19acfe6c10e342713e5b4fbf26be69b4af74e3f0fd8dbf323ef8012102524af713c5a64f26a1a7ccf1d752146e4c8cbaea08ef0848fe3dc80961747245ffffffff01e02e0000000000001976a914d2ee0dda3473302abe5c9c315a6da0581d543a9888ac00000000')
  })
})
