import chai from 'chai'
import MockTransmitter from '../../../sdk/device/transmit/MockTransmitter'
import WalletData from '../../../sdk/device/fat/WalletData'
import D from '../../../sdk/D'

chai.should()

describe('WalletData', function () {
  this.timeout(10 * 60 * 1000)

  const walletData = new WalletData(new MockTransmitter())

  before(async function () {
    await walletData.init()
  })

  it('test', function () {
    (1 + 1).should.equal(2)
  })

  const testParseAndBuild = (object) => {
    console.info('object', object)
    let data = WalletData._toTLV(object)
    console.info('data', data.toString('hex'))
    let object2 = WalletData._parseTLV(data)
    console.info('object2', object2)
    object.should.deep.equal(object2)

    let data2 = WalletData._toTLV(object2)
    console.info('data2', data.toString('hex'))
    data.should.deep.equal(data2)
  }

  it('parse CoinWalletData', function () {
    let cnw = {
      walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
      walletName: 'jajaja cnw',
      walletDataVersion: 1,
      walletDataStamp: 1539229257582,
      account: [{
        coinType: D.coin.main.btc,
        amount: 1
      }, {
        coinType: D.coin.test.btcTestNet3,
        amount: 2
      }, {
        coinType: D.coin.main.eth,
        amount: 3
      }, {
        coinType: D.coin.test.ethRinkeby,
        amount: 2
      }, {
        coinType: D.coin.test.ethRopsten,
        amount: 4
      }]
    }

    testParseAndBuild(cnw)
  })

  it('parse CoinAccountData', function () {
    let cnaBtc2 = {
      coinType: D.coin.main.btc,
      accountIndex: 2,
      accountName: 'jajaja cna_btc_2',
      accountExternalIndex: 10,
      accountChangeIndex: 28,
      txInfo: [{
        txId: Buffer.from('1111', 'hex'),
        txComment: 'this is a comment1'
      }, {
        txId: Buffer.from('123124', 'hex'),
        txComment: 'this is a comment2'
      }, {
        txId: Buffer.from('5311271a9a43179bdb38ef3f0d94861d50f72d734e69a70f354c8dc82d45f01c', 'hex'),
        txComment: 'this is a comment3'
      }, {
        txId: Buffer.from('42de455b0c3c6ea895f27348cf6f72d388b74111498f5085470891316293e3b2', 'hex'),
        txComment: 'this is a comment4'
      }]
    }

    testParseAndBuild(cnaBtc2)
  })

  it('parse with string >= 0xf0', function () {
    let cnaBtc2 = {
      coinType: D.coin.main.btc,
      accountIndex: 2,
      accountName: 'jajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajajaja',
      accountExternalIndex: 10,
      accountChangeIndex: 28,
      txInfo: [{
        txId: Buffer.from('1111', 'hex'),
        txComment: 'this is a comment1'
      }, {
        txId: Buffer.from('123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124123124', 'hex'),
        txComment: 'this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2 this is a comment2'
      }, {
        txId: Buffer.from('5311271a9a43179bdb38ef3f0d94861d50f72d734e69a70f354c8dc82d45f01c', 'hex'),
        txComment: 'this is a comment3'
      }, {
        txId: Buffer.from('42de455b0c3c6ea895f27348cf6f72d388b74111498f5085470891316293e3b2', 'hex'),
        txComment: 'this is a comment4'
      }]
    }

    testParseAndBuild(cnaBtc2)
  })
})
