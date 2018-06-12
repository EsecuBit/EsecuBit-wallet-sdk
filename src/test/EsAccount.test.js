
import chai from 'chai'
import D from '../sdk/D'
import EsWallet from '../sdk/EsWallet'

chai.should()
describe('BtcAccount', function () {
  this.timeout(60000)
  let esWallet

  it('parseBitcoinRawTx', () => {
    let tx = D.parseBitcoinRawTx('0100000005625b6be72af8ee2123eb28f505cb9d028c5574bd5c03936598299c2f049ea02d03000000fd640100483045022100ca4da02019b4211cb8ab41a5630b664f8c92e0cb936e002b63420fa3debe3709022072090bbf1c80aa2cc74866b2b5063c5cdb45f8685000977f061041cfd8dc1821014830450221009a200e9348c3c5744ccc3428131eeefb144fdeedcd69d23f3c8b9c32b801245e02204a5be4691bd330a80e219d0fda133df646cc7d0a63ad5118b569f45b6f833ed0014ccf5221024b2ea0ba3f77ef6b2bb396837739a3108e9aea44ac25a46f43a3dd48bdce668621028f1c1a9772544913f1bab4e651aa772eacc8fb99560873953cb9aefb9202ae472102a8110ebdb18f3454ff04f077f29c120822f327f588932f7b9e2361989f2f9f5f2102b154f51035ae72678bccc28076bd4ae61ac5af64df022b419c55cb2304b43180210385d1fa59a38eddd1ed27be13836f80fa24853b1c7fac9e417a95a1843bcf6bd72103916c92eafd0ba91db2ba9a4f843188a5f0181df4d5776ca555ababc47e1c04b756aeffffffff21971a6432af6c3811a2608557f13cefc14b2759c880854104320b3a3859491003000000fd63010047304402204a8c24a784864fede6dabfbb06974e6b33ebce201af8e06d91d59ac5230d708602207eeb87ff51d4db547e8f43473552d6795215027ac9d146ebee408862a66cbf170148304502210087ee944d0f6ecafa2e53dd0bae20862823b5d47c95432db8dcb5f1a0212a1f2f022072c8e40aae15d0769f9c1e5f7ca7590c29c8ddc3d13016247ccfb4f6c1250bbf014ccf522102a419b762d04ef7f2fc24d8101f4cf93b8efc11bacd0a814f373648f55625f2662102ad018aecc009b0b7f8d214782a7aa025dc4b758ac9064a9e4ad9770dfc1e17472102af84ea5dc8c5ac541d177f95ec8719c8d0dfbff4b6d554b09c3afdb2aae3d4c22102eb2d5f583800c20829a43d39b8ae0cb464d8df11b0025a843aff6a911960fad521039a45c46c61673da7d38cd9998507a457741f6c53ffe4a830a2c687301b9d25ae2103fcef8c467dc26bb0ee42f6111d6761edcb6e8f515702b3f85dbb5d60f7f2d47456aeffffffff625b6be72af8ee2123eb28f505cb9d028c5574bd5c03936598299c2f049ea02d02000000fd630100473044022001fee92d82f7012a574fa70b0b5bfc18bbb7da814353b19efa64758f3ad6c123022020428bf62c783fcfc74b4eeb736b7899fdb93d27bbb09bff7dcf8fb9ecf1792901483045022100fe22f6c6b39b1c7fa8ad30d5f0ff4761f1524206745490222a44e12d1c2668a60220304b7206537ea49b042057c53b39af676621ec30e8605928977717ff3890a7a6014ccf5221024b2ea0ba3f77ef6b2bb396837739a3108e9aea44ac25a46f43a3dd48bdce668621028f1c1a9772544913f1bab4e651aa772eacc8fb99560873953cb9aefb9202ae472102a8110ebdb18f3454ff04f077f29c120822f327f588932f7b9e2361989f2f9f5f2102b154f51035ae72678bccc28076bd4ae61ac5af64df022b419c55cb2304b43180210385d1fa59a38eddd1ed27be13836f80fa24853b1c7fac9e417a95a1843bcf6bd72103916c92eafd0ba91db2ba9a4f843188a5f0181df4d5776ca555ababc47e1c04b756aeffffffff625b6be72af8ee2123eb28f505cb9d028c5574bd5c03936598299c2f049ea02d04000000fd630100483045022100cf9430f9c678ef998083a3bc65855955437db7f825a43485c2289c8388dd0e4a02207f695e909687105d3e1715ae83d27a8318bffe3f3eba196836b6c078165e4fb80147304402204fe685585c886e159e8fa76cc522109d65e4d6f318a0aefc646f556dbe34a9ae022019c27bb9e256cb58e34219c6cc26347b6f78ad5cd09398b25a68d1b0f4dee4e0014ccf5221024b2ea0ba3f77ef6b2bb396837739a3108e9aea44ac25a46f43a3dd48bdce668621028f1c1a9772544913f1bab4e651aa772eacc8fb99560873953cb9aefb9202ae472102a8110ebdb18f3454ff04f077f29c120822f327f588932f7b9e2361989f2f9f5f2102b154f51035ae72678bccc28076bd4ae61ac5af64df022b419c55cb2304b43180210385d1fa59a38eddd1ed27be13836f80fa24853b1c7fac9e417a95a1843bcf6bd72103916c92eafd0ba91db2ba9a4f843188a5f0181df4d5776ca555ababc47e1c04b756aeffffffff625b6be72af8ee2123eb28f505cb9d028c5574bd5c03936598299c2f049ea02d05000000fd630100483045022100a554879d1bc5464c63407155cef45ae0c850b709852f36bdf8415c5856c4c79e0220166a7ad57a00140337c0334b0c6f4a1429183dc7608bf3ff308174ac2badfce40147304402205b81d4064f478c6bfe79acd91f6cf4e6b4aa025cc2e5964927b2937ca69aa94f022029e4174ef4f600ae5dede56691fd3f8e4515173cb8dc0e417f28e9c7ca38fed7014ccf5221024b2ea0ba3f77ef6b2bb396837739a3108e9aea44ac25a46f43a3dd48bdce668621028f1c1a9772544913f1bab4e651aa772eacc8fb99560873953cb9aefb9202ae472102a8110ebdb18f3454ff04f077f29c120822f327f588932f7b9e2361989f2f9f5f2102b154f51035ae72678bccc28076bd4ae61ac5af64df022b419c55cb2304b43180210385d1fa59a38eddd1ed27be13836f80fa24853b1c7fac9e417a95a1843bcf6bd72103916c92eafd0ba91db2ba9a4f843188a5f0181df4d5776ca555ababc47e1c04b756aeffffffff0b60e316000000000017a914377c81918a17273a9fcda11cd72ed43233368e7287200b20000000000017a914fa9629646883954f71da06c69156517c7c1662c987828d5200000000001976a9146fe1e54fc506404570a3d7074d7dff6a1ec12b1988ac763a63000000000017a9145876b4cab8ae5d944d98fe3623d0bb1e1b75d7cb87fa0e2805000000001976a914e31e1e1b68e672adc291c4495a1438dbdf030cbf88acb0bf3d000000000017a91481987422b78e406c48511c30b7962030e8b4e06f87b0bf3d000000000017a91481987422b78e406c48511c30b7962030e8b4e06f87b0bf3d000000000017a91481987422b78e406c48511c30b7962030e8b4e06f87b0bf3d000000000017a91481987422b78e406c48511c30b7962030e8b4e06f87b0bf3d000000000017a91481987422b78e406c48511c30b7962030e8b4e06f872da403000000000017a91481987422b78e406c48511c30b7962030e8b4e06f8700000000')
    console.log(tx)
  })

  // new EsWallet will have heavy work, so do the lazy work
  it('new wallet', async () => {
    D.test.sync = false
    esWallet = new EsWallet()
  })

  it('listenStatus', (done) => {
    const statusList = [D.status.plugIn, D.status.initializing, D.status.syncing, D.status.syncFinish]
    let currentStatusIndex = 0

    esWallet.listenTxInfo((error, txInfo) => {
      console.log('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.log('error, status', error, status)
      if (error !== D.error.succeed) {
        done(error)
        return
      }
      if (status !== statusList[currentStatusIndex]) {
        done(status !== statusList[currentStatusIndex])
        return
      }
      currentStatusIndex++
      if (currentStatusIndex === statusList.length) {
        done()
      }
    })
  })

  let account = null
  it('checkAccount', async () => {
    let accounts = await esWallet.getAccounts()
    accounts.length.should.not.equal(0)
    accounts[0].coinType.should.equal(D.coin.test.btcTestNet3)
    account = accounts[0]
    account.utxos.length.should.above(0)
    account.addressInfos.length.should.above(0)
    account.balance.should.above(0)
  })

  it('getTxInfos', async () => {
    let {total, txInfos} = await account.getTxInfos(0, 100)
    total.should.above(0)
    txInfos.length.should.not.equal(0)
    txInfos.forEach(tx => {
      tx.accountId.should.equal(account.accountId)
      tx.coinType.should.equal(account.coinType)
      tx.txId.should.be.a('string').and.lengthOf(64)
      tx.version.should.above(0)
      tx.blockNumber.should.be.a('number')
      tx.confirmations.should.be.a('number')
      tx.time.should.be.a('number')
      tx.direction.should.be.oneOf([D.tx.direction.in, D.tx.direction.out])
      tx.inputs.should.lengthOf.above(0)
      tx.outputs.should.lengthOf.above(0)
      tx.value.should.not.equal(0)
      tx.inputs.forEach(input => {
        input.prevAddress.should.be.a('string')
        input.isMine.should.be.a('boolean')
        input.value.should.above(0)
      })
      tx.outputs.forEach(output => {
        output.address.should.be.a('string')
        output.isMine.should.be.a('boolean')
        output.value.should.above(0)
      })
    })
  })

  it('rename', async () => {
    let oldName = account.label
    let newName = 'This is a test account name'
    await account.rename(newName)
    account.label.should.not.equal(oldName)
    account.label.should.equal(newName)

    let reloadAccount = (await esWallet.getAccounts()).find(a => a.accountId === account.accountId)
    reloadAccount.should.not.equal(undefined)
    reloadAccount.label.should.not.equal(oldName)
    reloadAccount.label.should.equal(newName)

    await account.rename(oldName)
    account.label.should.not.equal(newName)
    account.label.should.equal(oldName)

    reloadAccount = (await esWallet.getAccounts()).find(a => a.accountId === account.accountId)
    reloadAccount.should.not.equal(undefined)
    reloadAccount.label.should.not.equal(newName)
    reloadAccount.label.should.equal(oldName)
  })

  it('getAddress', async () => {
    let address = await account.getAddress()
    address.address.should.be.a('string')
    address.qrAddress.should.be.a('string')
  })

  it('getSuggestedFee', () => {
    let fee = account.getSuggestedFee()
    console.log('suggested fee', fee)
    fee[D.fee.economic].should.above(0)
    fee[D.fee.normal].should.at.least(fee[D.fee.economic])
    fee[D.fee.fast].should.at.least(fee[D.fee.normal])
  })

  it('sendTx', async () => {
    let prepareTx = await account.prepareTx({
      feeRate: 10,
      outputs: [{
        address: 'mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X',
        value: 30000
      }, {
        address: 'mqjGANawowPiTDKKtuqdf7mqumWAoyHsdG',
        value: 10000
      }]
    })
    console.log('prepareTx', prepareTx)
    let signedTx = await account.buildTx(prepareTx)
    console.log('signedTx', signedTx)
    // await account.sendTx(signedTx)
  })
})
