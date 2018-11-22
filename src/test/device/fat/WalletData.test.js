import chai from 'chai'
import MockTransmitter from '../../../sdk/device/implements/transmitter/MockTransmitter'
import WalletData from '../../../sdk/device/implements/fat/WalletData'
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
    console.log('object', object)
    let data = WalletData._toTLV(object)
    console.log('data', data.toString('hex'))
    let object2 = WalletData._parseTLV(data)
    console.log('object2', object2)
    object.should.deep.equal(object2)

    let data2 = WalletData._toTLV(object2)
    console.log('data2', data.toString('hex'))
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
      accountIndex: 0,
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

  const data = {
    v1: {
      lastSyncVersion: undefined,
      cnw: {
        walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
        walletName: 'jajaja cnw',
        walletDataVersion: 1,
        walletDataStamp: 1539229257582,
        account: [{
          coinType: D.coin.main.btc,
          amount: 1
        }]
      },
      cnaBtc0: {
        coinType: D.coin.main.btc,
        accountIndex: 0,
        accountName: 'jajaja cna_btc_0',
        accountExternalIndex: 1,
        accountChangeIndex: 2,
        txInfo: [{
          txId: Buffer.from('1111', 'hex'),
          txComment: 'this is a comment1'
        }]
      }
    },
    v3: {
      lastSyncVersion: 1,
      cnw: {
        walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
        walletName: 'jajaja cnw v3',
        walletDataVersion: 3,
        walletDataStamp: 1539229257582,
        account: [{
          coinType: D.coin.main.btc,
          amount: 2
        }]
      },
      cnaBtc0: {
        coinType: D.coin.main.btc,
        accountIndex: 0,
        accountName: 'jajaja cna_btc_0 v3',
        accountExternalIndex: 6,
        accountChangeIndex: 8,
        txInfo: [{
          txId: Buffer.from('1111', 'hex'),
          txComment: 'this is a comment1'
        }, {
          txId: Buffer.from('2222', 'hex'),
          txComment: 'this is a comment2'
        }]
      },
      cnaBtc1: {
        coinType: D.coin.main.btc,
        accountIndex: 1,
        accountName: 'jajaja cna_btc_1 v3',
        accountExternalIndex: 6,
        accountChangeIndex: 8,
        txInfo: []
      }
    },
    v6: {
      lastSyncVersion: 1,
      cnw: {
        walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
        walletName: 'jajaja cnw v6',
        walletDataVersion: 6,
        walletDataStamp: 1539229257582,
        account: [{
          coinType: D.coin.main.btc,
          amount: 1
        }, {
          coinType: D.coin.main.eth,
          amount: 1
        }]
      },
      cnaBtc0: {
        coinType: D.coin.main.btc,
        accountIndex: 0,
        accountName: 'jajaja cna_btc_0 v6',
        accountExternalIndex: 3,
        accountChangeIndex: 10,
        txInfo: [{
          txId: Buffer.from('3333', 'hex'),
          txComment: 'this is a comment3'
        }]
      },
      cnaEth0: {
        coinType: D.coin.main.eth,
        accountIndex: 0,
        accountName: 'jajaja cna_eth_0 v6',
        accountExternalIndex: 1,
        accountChangeIndex: 0,
        txInfo: [{
          txId: Buffer.from('2222', 'hex'),
          txComment: 'this is a comment2'
        }, {
          txId: Buffer.from('4444', 'hex'),
          txComment: 'this is a comment4'
        }]
      }
    },

    mergeV3V6: {
      cnw: {
        walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
        walletName: 'jajaja cnw v6',
        walletDataVersion: 7,
        walletDataStamp: 1539229257582,
        account: [{
          coinType: D.coin.main.btc,
          amount: 2
        }, {
          coinType: D.coin.main.eth,
          amount: 1
        }]
      },
      cnaBtc0: {
        coinType: D.coin.main.btc,
        accountIndex: 0,
        accountName: 'jajaja cna_btc_0 v6',
        accountExternalIndex: 3,
        accountChangeIndex: 10,
        txInfo: [{
          txId: Buffer.from('3333', 'hex'),
          txComment: 'this is a comment3'
        }, {
          txId: Buffer.from('1111', 'hex'),
          txComment: 'this is a comment1'
        }, {
          txId: Buffer.from('2222', 'hex'),
          txComment: 'this is a comment2'
        }]
      }
    }
  }

  it('sync: first time', async function () {
    let cnw = data.v1.cnw
    let cnaBtc0 = data.v1.cnaBtc0
    let lastSyncVersion = data.v1.lastSyncVersion

    await walletData.sync(cnw, [cnaBtc0], lastSyncVersion)
    let cnw2 = await walletData.getWalletInfo()
    cnw.should.deep.equal(cnw2)

    let accountInfos = await walletData.getAccountInfos(cnw)
    accountInfos.should.lengthOf(1)
    accountInfos[0].should.deep.equal(cnaBtc0)

    let cnaBtc02 = await walletData.getAccountInfo(D.coin.main.btc, 0)
    cnaBtc02.should.deep.equal(cnaBtc0)
  })

  it('sync: update app -> device', async function () {
    let cnw = data.v3.cnw
    let cnaBtc0 = data.v3.cnaBtc0
    let cnaBtc1 = data.v3.cnaBtc1
    let lastSyncVersion = data.v3.lastSyncVersion

    await walletData.sync(cnw, [cnaBtc0, cnaBtc1], lastSyncVersion)
    let cnw2 = await walletData.getWalletInfo()
    cnw.should.deep.equal(cnw2)

    let accountInfos = await walletData.getAccountInfos(cnw)
    accountInfos.should.lengthOf(2)
    accountInfos[0].should.deep.equal(cnaBtc0)
    accountInfos[1].should.deep.equal(cnaBtc1)

    let cnaBtc02 = await walletData.getAccountInfo(D.coin.main.btc, 0)
    cnaBtc02.should.deep.equal(cnaBtc0)
    let cnaBtc12 = await walletData.getAccountInfo(D.coin.main.btc, 1)
    cnaBtc12.should.deep.equal(cnaBtc1)
  })

  it('sync: update device -> app', async function () {
    let cnw = data.v1.cnw
    let cnaBtc0 = data.v1.cnaBtc0
    let lastSyncVersion = data.v1.cnw.walletDataVersion

    await walletData.sync(cnw, [cnaBtc0], lastSyncVersion)
    let cnw2 = await walletData.getWalletInfo()
    cnw2.should.deep.equal(data.v3.cnw)

    let accountInfos = await walletData.getAccountInfos(cnw2)
    accountInfos.should.lengthOf(2)
    accountInfos[0].should.deep.equal(data.v3.cnaBtc0)
    accountInfos[1].should.deep.equal(data.v3.cnaBtc1)

    let cnaBtc02 = await walletData.getAccountInfo(D.coin.main.btc, 0)
    cnaBtc02.should.deep.equal(data.v3.cnaBtc0)
    let cnaBtc12 = await walletData.getAccountInfo(D.coin.main.btc, 1)
    cnaBtc12.should.deep.equal(data.v3.cnaBtc1)
  })

  it('sync: merge app <-> device', async function () {
    let cnw = data.v6.cnw
    let cnaBtc0 = data.v6.cnaBtc0
    let cnaEth0 = data.v6.cnaEth0
    let lastSyncVersion = data.v6.lastSyncVersion

    await walletData.sync(cnw, [cnaBtc0, cnaEth0], lastSyncVersion)
    let cnw2 = await walletData.getWalletInfo()
    cnw2.should.deep.equal({
      walletId: '01013178300dD1f76281A6c0Ce62E27A56Ea0CB403ba',
      walletName: 'jajaja cnw v6',
      walletDataVersion: 7,
      walletDataStamp: 1539229257582,
      account: [{
        coinType: D.coin.main.btc,
        amount: 2
      }, {
        coinType: D.coin.main.eth,
        amount: 1
      }]
    })

    let accountInfos = await walletData.getAccountInfos(cnw2)
    accountInfos.should.lengthOf(3)
    accountInfos[0].should.deep.equal(data.mergeV3V6.cnaBtc0)
    accountInfos[1].should.deep.equal(data.v3.cnaBtc1)
    accountInfos[2].should.deep.equal(data.v6.cnaEth0)

    let cnaBtc02 = await walletData.getAccountInfo(D.coin.main.btc, 0)
    cnaBtc02.should.deep.equal(data.mergeV3V6.cnaBtc0)
    let cnaBtc12 = await walletData.getAccountInfo(D.coin.main.btc, 1)
    cnaBtc12.should.deep.equal(data.v3.cnaBtc1)
    let cnaEth02 = await walletData.getAccountInfo(D.coin.main.eth, 0)
    cnaEth02.should.deep.equal(data.v6.cnaEth0)
  })
})
