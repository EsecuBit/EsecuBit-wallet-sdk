
import chai from 'chai'
import D from '../../sdk/D'
import JsWallet from '../../sdk/device/JsWallet'

chai.should()
D.test.sync = true
D.test.mode = true
describe('JsWallet Bitcoin', function () {
  this.timeout('10000')
  const jsWallet = new JsWallet()

  it('init', async () => {
    await jsWallet.init()
  })

  it('getAddress', async () => {
    let address = await jsWallet.getAddress(D.coin.test.btcTestNet3, "m/44'/0'/0'/0/0")
    address.should.equal('mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR')
  })

  it('signTransaction', async () => {
    let response = await jsWallet.signTransaction(D.coin.test.btcTestNet3, {
      inputs: [{
        address: 'mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR',
        path: "m/44'/0'/0'/0/0",
        txId: '61d520ccb74288c96bc1a2b20ea1c0d5a704776dd0164a396efec3ea7040349d',
        index: 0
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
    let publicKey5 = await jsWallet.getPublicKey("m/44'/0'/0'/0/100")
    let publicKey4 = await jsWallet.getPublicKey("m/44'/0'/0'/0")
    let publicKey4to5 = await jsWallet.getPublicKey(100, publicKey4)
    publicKey5.should.deep.equal(publicKey4to5)
    console.log('publicKey5', publicKey5)
  })

  it('deriveAddress', async () => {
    let address5 = await jsWallet.getAddress(D.coin.test.btcTestNet3, "m/44'/0'/0'/0/100")
    let publicKey4 = await jsWallet.getPublicKey("m/44'/0'/0'/0")
    let address4to5 = await jsWallet.getAddress(D.coin.test.btcTestNet3, 100, publicKey4)
    address5.should.deep.equal(address4to5)
    console.log('address5', address5)
  })
})

describe('JsWallet Ethernum', function () {
  this.timeout('10000')
  const jsWallet = new JsWallet()

  it('init', async () => {
    await jsWallet.init()
  })

  it('getAddress', async () => {
    let address = await jsWallet.getAddress(D.coin.test.ethRinkeby, "m/44'/60'/0'/0/0")
    address.should.equal('0x79c744891902a0319b1322787190efaba5dbea72')
  })
})
