
require('chai').should()
const D = require('../../sdk/D').class
const wallet = require('../../sdk/device/JsWallet').instance

const OTHER_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'

describe('Generate Testnet Test Sync Data', function () {
  this.timeout('1000000')

  // transaction 1: otherguy address 0 -> extend address 0 (other -> you)
  // transaction 2: extend address 0 -> change address 0 (you -> change)
  // transaction 3: change address 0 -> other address 0 + change address 1 (you -> other + change)
  // transaction 4: change address 1  -> change address 1 + change address 21 (you -> you + change)
  // transaction 5: change address 1 + change address 21 -> other address 1 + extend address 4 (you1 + you2 -> other + you)
  // transaction 6: otherguy address 1 -> extend address 24 (other -> you)
  // transaction 7: extend address 24 -> extend address 24 (you -> you)
  // transaction 8: extend address 24 -> extend address 44 (you -> you + 20)
  // transaction 9: otherguy address 2 -> extend address 0 (other -> you again)
  // transaction 10: extend address 44 -> other address 2 (you -> other)

  // 69432710 -> 69431710 + 1000(fee)
  this.transaction2 = {
    id: 'd5dcab055c8c6cf424014f6684093e88636f18d2e8cb50bb73b764375a0bdf5e',
    hex: '01000000019689e769cc49904d4f4cd7702e1d1abb43a2587444c536a6e019b39c0075173a000000006a47304402206081303be6508705aa8f5cb512f319238def1a843e60141103b188efb55da28502204e27fda51c6fb9bb26998f2454eb6f5cd79729bbc670d007f1840b702ed3a096012102524af713c5a64f26a1a7ccf1d752146e4c8cbaea08ef0848fe3dc80961747245ffffffff019e712304000000001976a914dbe4f06cbdc8e40a8d399d9a7a1c99dabe74a9d688ac00000000'
  }
  // 69431710 -> 10000000 + 59431210 + 500(fee)
  this.transaction3 = {
    id: '',
    hex: ''
  }

  this.otherAddress0 = 'mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8'
  this.otherAddress1 = 'mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X'
  this.otherAddress2 = 'mqjGANawowPiTDKKtuqdf7mqumWAoyHsdG'

  this.extendAddress0 = 'mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR' // 69432710 -> 0
  this.extendAddress4 = 'mx1ZzXmZTaV55t7vm3uTw3X9TnFGhTQPsU'
  this.extendAddress24 = 'mnSdnqUD41Rkx9YhQcUddYwC2j3ju7sm8D'
  this.extendAddress44 = 'mzzXogigLmnCfisTgGYg956dRwB2PyZwKx'

  this.changeAddress0 = 'n1ZeY35ALhicxFi4PYc4Nc77B9zzzzfAzM' // 0 -> 69431710 -> 0
  this.changeAddress1 = 'mxFYnrJoMHP5jnFpTwvoEi2SmN2kNB6Cmr'
  this.changeAddress21 = 'n2QUFCMrJ9jPqSbmpD9jkDLEs3GHBmQthE'

  it('generateAddress', async () => {
    await wallet.init(OTHER_SEED)
    let otherAddress0 = await wallet.getAddress("m/44'/0'/0'/0/0")
    let otherAddress1 = await wallet.getAddress("m/44'/0'/0'/0/1")
    let otherAddress2 = await wallet.getAddress("m/44'/0'/0'/0/2")

    await wallet.init()
    let extendAddress0 = await wallet.getAddress("m/44'/0'/0'/0/0")
    let extendAddress4 = await wallet.getAddress("m/44'/0'/0'/0/4")
    let extendAddress24 = await wallet.getAddress("m/44'/0'/0'/0/24")
    let extendAddress44 = await wallet.getAddress("m/44'/0'/0'/0/44")

    let changeAddress0 = await wallet.getAddress("m/44'/0'/0'/1/0")
    let changeAddress1 = await wallet.getAddress("m/44'/0'/0'/1/1")
    let changeAddress21 = await wallet.getAddress("m/44'/0'/0'/1/21")

    otherAddress0.should.equal(this.otherAddress0)
    otherAddress1.should.equal(this.otherAddress1)
    otherAddress2.should.equal(this.otherAddress2)

    extendAddress0.should.equal(this.extendAddress0)
    extendAddress4.should.equal(this.extendAddress4)
    extendAddress24.should.equal(this.extendAddress24)
    extendAddress44.should.equal(this.extendAddress44)

    changeAddress0.should.equal(this.changeAddress0)
    changeAddress1.should.equal(this.changeAddress1)
    changeAddress21.should.equal(this.changeAddress21)

    console.log('extendAddress0', extendAddress0)
    console.log('extendAddress4', extendAddress4)
    console.log('extendAddress24', extendAddress24)
    console.log('extendAddress44', extendAddress44)

    console.log('changeAddress0', changeAddress0)
    console.log('changeAddress1', changeAddress1)
    console.log('changeAddress21', changeAddress21)

    console.log('otherAddress0', otherAddress0)
    console.log('otherAddress1', otherAddress1)
    console.log('otherAddress2', otherAddress2)
  })

  it('generateTx2', async () => {
    await wallet.init()
    let transaction2 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.extendAddress0,
        prevAddressPath: "m/44'/0'/0'/0/0",
        prevTxId: '3a1775009cb319e0a636c5447458a243bb1a1d2e70d74c4f4d9049cc69e78996',
        prevOutIndex: 0
      }],
      outputs: [{
        address: this.changeAddress0,
        value: 69431710
      }]
    })
    transaction2.should.deep.equal(this.transaction2)
    console.log('transaction2', transaction2)
  })

  it('generateTx3', async () => {
    await wallet.init()
    let transaction3 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.changeAddress0,
        prevAddressPath: "m/44'/0'/0'/0/0",
        prevTxId: '3a1775009cb319e0a636c5447458a243bb1a1d2e70d74c4f4d9049cc69e78996',
        prevOutIndex: 0
      }],
      outputs: [{
        address: this.otherAddress0,
        value: 69431710
      }, {
        address: this.changeAddress1,
        value: 69431710
      }]
    })
    // transaction2.should.deep.equal(this.transaction2)
    console.log('transaction2', transaction2)

    const BlockChainInfo = require('../../sdk/data/network/BlockChainInfo').class
    let network = new BlockChainInfo()
    await network.init(D.COIN_BIT_COIN_TEST)
    let response = await network.sendTransaction(transaction3)
    console.log('response', response)
  })
})
