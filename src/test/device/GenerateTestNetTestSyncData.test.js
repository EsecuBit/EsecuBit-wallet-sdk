
require('chai').should()
const wallet = require('../../sdk/device/JsWallet').instance

const OTHER_SEED = 'aa49342d805682f345135afcba79ffa7d50c2999944b91d88e01e1d300000000'

describe('Generate Testnet Test Sync Data', function () {
  this.timeout('1000000')

  // transaction 1: otherguy address 0 -> extend address 0 (other -> you)
  // -> 69432710
  // id: 3a1775009cb319e0a636c5447458a243bb1a1d2e70d74c4f4d9049cc69e78996

  // transaction 2: extend address 0 -> change address 0 (you -> change)
  // 69432710 -> 69431710 + 1000(fee)
  this.transaction2 = {
    id: 'd5dcab055c8c6cf424014f6684093e88636f18d2e8cb50bb73b764375a0bdf5e',
    hex: '01000000019689e769cc49904d4f4cd7702e1d1abb43a2587444c536a6e019b39c0075173a000000006a47304402206081303be6508705aa8f5cb512f319238def1a843e60141103b188efb55da28502204e27fda51c6fb9bb26998f2454eb6f5cd79729bbc670d007f1840b702ed3a096012102524af713c5a64f26a1a7ccf1d752146e4c8cbaea08ef0848fe3dc80961747245ffffffff019e712304000000001976a914dbe4f06cbdc8e40a8d399d9a7a1c99dabe74a9d688ac00000000'
  }

  // transaction 3: change address 0 -> other address 0 + change address 1 (you -> other + change)
  // 69431710 -> 10000000 + 59431210 + 500(fee)
  this.transaction3 = {
    id: '45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10',
    hex: '01000000015edf0b5a3764b773bb50cbe8d2186f63883e0984664f0124f46c8c5c05abdcd5000000006b483045022100b456872898c29ccf73de391732488ea929a67d1d041e814c8e6ab078724356a80220554300892f0f13bbc6162ffc278d6fca928b02fa1ae6dc99fe5bd21189bcda7301210211b0fea7e69fb07809aefea59cf3b4f1034102fa4d2cd6f8adc204ffea10fa9fffffffff0280969800000000001976a914951d72fd25e82be5c1c31e0d9ab34372edc4e10588ac2ad98a03000000001976a914b79047772fb5b4237aec1ce53dad76ead349232588ac00000000'
  }

  // transaction 4: change address 1  -> change address 1 + change address 21 (you -> you + change)
  // 59431210 -> 53431110 + 5650000 + 350100(fee)
  this.transaction4 = {
    id: '2627c3bfbba12017a380644ecf005a246ea92ee7e046f25dd832ca4b06fc898f',
    hex: '0100000001106fc1dcf6f49d38ce5599e5150746b14556ec3c36fedf610973677d70a9a145010000006b483045022100bc4a040ebcf05c7fbb967cfb261a547aa94c25b376b0535d914c046c24484d8202203a884c6b8258f66839192bbb730029e176bd3996cad516dd6f774a89b15e04410121037fd9d3aa263c2089c65daf4dac09f64b322cef2702b877ee824de817ea2f123dffffffff02464b2f03000000001976a914b79047772fb5b4237aec1ce53dad76ead349232588ac50365600000000001976a914e520bb3933ab1333d34092e4722fd4f8be856dc988ac00000000'
  }

  // transaction 5: change address 1 + change address 21 -> extend address 4 + change address 21 (you1 + you2 -> you3 + you1)
  // 53431110 + 5650000 -> 40000000 + 19061110 + 20000(fee)
  this.transaction5 = {
    id: '75a5866ecd001d616b0f785bbdd82f0dd3c742dda276e05be30e82fb5ac233e6',
    hex: '01000000028f89fc064bca32d85df246e0e72ea96e245a00cf4e6480a31720a1bbbfc32726000000006b483045022100999cef0de64a059aed80f3a4927f849bcdadc5654634829159882abda87770ea0220278d0a7abcc6038665efa5a2afa0b7f794be55e7d43956b9ae26873bb9589dc40121037fd9d3aa263c2089c65daf4dac09f64b322cef2702b877ee824de817ea2f123dffffffff8f89fc064bca32d85df246e0e72ea96e245a00cf4e6480a31720a1bbbfc32726010000006a47304402201f0dfc074795100c2efee845d9d9e803fabd2a0426b2c13fa4ee501b18c25df802201e062772f5a9c917f526ec32234c917ae1dabcfce2e00bb311f9ce3eb66eed5701210206e13a380ba165014c3b7df6b0e1e645df0d9156a3b1674660ab5b14fda8c232ffffffff02005a6202000000001976a914b4eb75646c6d599e45e88adc071301da2c548a7d88ac76d92201000000001976a914e520bb3933ab1333d34092e4722fd4f8be856dc988ac00000000'
  }

  // transaction 6: otherguy address 1 -> extend address 24 (other -> you)
  // -> 1957264260
  // id: 994cfa6b56a3e5798eeb9cbf45f24a8a17df7eee4ec4fd674098a4c14e16d3cb

  // transaction 7: extend address 24 -> extend address 24 (you -> you)
  // 195726426 -> 195725426 + 1000(fee)
  this.transaction7 = {
    id: 'f2ba3440ceca4b702713e63d10f1133c7c3dd0669bd4d504cc6511cd2dfc817a',
    hex: '0100000001cbd3164ec1a4984067fdc44eee7edf178a4af245bf9ceb8e79e5a3566bfa4c99000000006b483045022100a513c11a151f417430fde5721cdf7fdb463af7e835bed787976e14cd664b7012022034fd62433418de64b766f4fea1e6ec61871853c4f5d5029099a6c3ac533d631d012103edb6d0e241995839b2cd315f13413574a92b58b24aa45bad1031480379e6c95bffffffff017288aa0b000000001976a9144bf7c53e95a2c68a27bf4f04aabf0eab7c62def188ac00000000'
  }

  // transaction 8: extend address 24 -> extend address 44 (you -> you + 20)
  // 195725426 -> 195718254 + 7172
  this.transaction8 = {
    id: '0e2e1428a3dac6098b66a954f6be837560ff70852c91776948ba73428aacad3e',
    hex: '01000000017a81fc2dcd1165cc04d5d49b66d03d7c3c13f1103de61327704bcace4034baf2000000006a47304402201b3af4d880fef6dcb3cdf1cf71f0d140b993bdda75417bb42f58093b01819769022068f57a6ee0cd7a481b49fa4972082c73e6341e23ee5d0712d565f27b9183545c012103edb6d0e241995839b2cd315f13413574a92b58b24aa45bad1031480379e6c95bffffffff016e6caa0b000000001976a914d5a19826cc6e945b29a781d971410d22b14438c088ac00000000'
  }

  // transaction 9: otherguy address 2 -> extend address 44 (other -> you again)
  // id: 114340bd2ed6dc58e42c619d15ebfda848c696229008cacc3aa270ce036e765e
  // 71677952

  this.otherAddress0 = 'mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8' // 10000000
  this.otherAddress1 = 'mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X' // 0
  this.otherAddress2 = 'mqjGANawowPiTDKKtuqdf7mqumWAoyHsdG' // 0

  this.extendAddress0 = 'mzkFNdNqZM6YN9r1STVMZeWvhCgfvqSfwR' // 69432710 -> 0
  this.extendAddress4 = 'mx1ZzXmZTaV55t7vm3uTw3X9TnFGhTQPsU' // 40000000
  this.extendAddress24 = 'mnSdnqUD41Rkx9YhQcUddYwC2j3ju7sm8D' // 1957264260 -> 195725426 -> 0
  this.extendAddress44 = 'mzzXogigLmnCfisTgGYg956dRwB2PyZwKx' // 195718254, 71677952

  this.changeAddress0 = 'n1ZeY35ALhicxFi4PYc4Nc77B9zzzzfAzM' // 69431710 -> 0
  this.changeAddress1 = 'mxFYnrJoMHP5jnFpTwvoEi2SmN2kNB6Cmr' // 59431210 -> 53431110 -> 0
  this.changeAddress21 = 'n2QUFCMrJ9jPqSbmpD9jkDLEs3GHBmQthE' // 5650000 -> 19061110

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
        prevAddressPath: "m/44'/0'/0'/1/0",
        prevTxId: 'd5dcab055c8c6cf424014f6684093e88636f18d2e8cb50bb73b764375a0bdf5e',
        prevOutIndex: 0
      }],
      outputs: [{
        address: this.otherAddress0,
        value: 10000000
      }, {
        address: this.changeAddress1,
        value: 59431210
      }]
    })
    transaction3.should.deep.equal(this.transaction3)
    console.log('transaction3', transaction3)
  })

  it('generateTx4', async () => {
    await wallet.init()
    let transaction4 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.changeAddress1,
        prevAddressPath: "m/44'/0'/0'/1/1",
        prevTxId: '45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10',
        prevOutIndex: 1
      }],
      outputs: [{
        address: this.changeAddress1,
        value: 53431110
      }, {
        address: this.changeAddress21,
        value: 5650000
      }]
    })
    transaction4.should.deep.equal(this.transaction4)
    console.log('transaction4', transaction4)
  })

  it('generateTx5', async () => {
    await wallet.init()
    let transaction5 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.changeAddress1,
        prevAddressPath: "m/44'/0'/0'/1/1",
        prevTxId: '2627c3bfbba12017a380644ecf005a246ea92ee7e046f25dd832ca4b06fc898f',
        prevOutIndex: 0
      }, {
        prevAddress: this.changeAddress21,
        prevAddressPath: "m/44'/0'/0'/1/21",
        prevTxId: '2627c3bfbba12017a380644ecf005a246ea92ee7e046f25dd832ca4b06fc898f',
        prevOutIndex: 1
      }],
      outputs: [{
        address: this.extendAddress4,
        value: 40000000
      }, {
        address: this.changeAddress21,
        value: 19061110
      }]
    })
    transaction5.should.deep.equal(this.transaction5)
    console.log('transaction5', transaction5)
  })

  it('generateTx7', async () => {
    await wallet.init()
    let transaction7 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.extendAddress24,
        prevAddressPath: "m/44'/0'/0'/0/24",
        prevTxId: '994cfa6b56a3e5798eeb9cbf45f24a8a17df7eee4ec4fd674098a4c14e16d3cb',
        prevOutIndex: 0
      }],
      outputs: [{
        address: this.extendAddress24,
        value: 195725426
      }]
    })
    transaction7.should.deep.equal(this.transaction7)
    console.log('transaction7', transaction7)
  })

  it('generateTx8', async () => {
    await wallet.init()
    let transaction8 = await wallet.signTransaction({
      inputs: [{
        prevAddress: this.extendAddress24,
        prevAddressPath: "m/44'/0'/0'/0/24",
        prevTxId: 'f2ba3440ceca4b702713e63d10f1133c7c3dd0669bd4d504cc6511cd2dfc817a',
        prevOutIndex: 0
      }],
      outputs: [{
        address: this.extendAddress44,
        value: 195718254
      }]
    })
    transaction8.should.deep.equal(this.transaction8)
    console.log('transaction8', transaction8)

    // const BlockChainInfo = require('../../sdk/data/network/BlockChainInfo').class
    // let network = new BlockChainInfo()
    // await network.init(D.COIN_BIT_COIN_TEST)
    // let response = await network.sendTransaction(transaction8.hex)
    // console.log('response', response)
  })
})
