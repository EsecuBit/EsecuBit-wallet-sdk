
require('chai').should()
const wallet = require('../../sdk/device/JsWallet').instance

describe('JsWallet', function () {
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
        address: '1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP',
        value: 12000
      }]
    })
    response.hex.should.equal(
      '01000000019d344070eac3fe6e394a16d06d7704a7d5c0a10eb2a2c16bc98842' +
      'b7cc20d561000000006a473044022004b9b566374f9f125df0fe6361ed416e63' +
      'cc77b7bae6be398d8a25a1cb7b555e02205217dee44ebf998e443b48c741a93b' +
      '24e680560f001f349a1010ed84445f745d012102524af713c5a64f26a1a7ccf1' +
      'd752146e4c8cbaea08ef0848fe3dc80961747245ffffffff01e02e0000000000' +
      '001976a91406afd46bcdfd22ef94ac122aa11f241244a37ecc88ac00000000')
  })
})
