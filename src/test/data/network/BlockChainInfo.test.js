
const D = require('../../../sdk/D').class
const BlockchainInfo = require('../../../sdk/data/network/BlockChainInfo').class
require('chai').should()

const blockchainInfo = new BlockchainInfo()

// TODO complete test
describe('Network Blockchain Bitcoin', function() {
  this.timeout(3000)
  it('init network', async () => {
    let response = await blockchainInfo.init(D.COIN_BIT_COIN)
    response.should.not.equal(undefined)
  })

  it('query address', async () => {
    let e = D.ERROR_NO_ERROR
    try {
      await blockchainInfo.queryAddress('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7')
    } catch (error) {
      e = error
    }
    e.should.equal(D.ERROR_NOT_IMPLEMENTED)
  })
  it('query addresses', async () => {
    let response = await blockchainInfo.queryAddresses(['1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7', '1j1UHnGwDdJhNf2h3mcFmzGDe2DzoEMuc'])
    response.should.deep.equal(
      [{
        address: '1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7',
        txCount: 1,
        txs: [{
          txId: '20a42ecd34af95dc5fd5197f8971f7d9d690f7e456abb8c1f6a6ef6a25b56616',
          version: 1,
          blockNumber: 521713,
          confirmations: 904,
          lockTime: 521712,
          time: 1525759340,
          hasDetails: true,
          inputs: [{
            prevAddress: '16U6ZaAf1s12fBWa858DyZDRQcLV83ck9C',
            value: 541039
          }],
          outputs: [{
            address: '1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7',
            value: 160123,
            index: 0,
            script: '76a9146ab25182b818711497747fa62b5b3c9d6ec8914588ac'
          }]
        }]
      }, {
        address: '1j1UHnGwDdJhNf2h3mcFmzGDe2DzoEMuc',
        txCount: 2,
        txs: [{
          txId: '54b84a9739077ef145d092fdd7ae3ead21df82255bb8decab12567adde1e39fe',
          version: 2,
          blockNumber: 522799,
          confirmations: 900,
          lockTime: 0,
          time: 1526391874,
          hasDetails: true,
          inputs: [{
            prevAddress: '1j1UHnGwDdJhNf2h3mcFmzGDe2DzoEMuc',
            value: 9436925000
          }],
          outputs: [{
            address: '18YmRqRmYkBUptDbwSDSL2PpbN8G2NqNRV',
            value: 3780000,
            index: 0,
            script: '76a91452cadcb1aec0f03b0f303835a063b806b308be3c88ac'
          }, {
            address: '1AjVUNYmi3vhT2MpZi8iZU11JaKrt1s8eQ',
            value: 9432945000,
            index: 1,
            script: '76a9146ac25e9ef9941656b3573a182cfe8d3fd3645d9188ac'
          }]
        }, {
          txId: 'a7f55ef931add74070676a693616a8b9bada3f7143c1bb5d512967c382498f7e',
          version: 2,
          blockNumber: 522507,
          confirmations: 904,
          lockTime: 0,
          time: 1526215668,
          hasDetails: true,
          inputs: [{
            prevAddress: '1DmxbbWM7nf3KCq7LFkF6vWPePCZrEUhCx',
            value: 9471415000
          }],
          outputs: [{
            address: '1j1UHnGwDdJhNf2h3mcFmzGDe2DzoEMuc',
            value: 9436925000,
            index: 1,
            script: '76a91407f1dcf79eca924b3dd1fda41eefb647a4644d6188ac'
          }]
        }]
      }])
  })
  it('query transaction', async () => {
    let response = await blockchainInfo.queryTransaction('b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da')
    response.should.deep.equal({
      txId: 'b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da',
      version: 1,
      blockNumber: 154598,
      confirmations: 1032,
      lockTime: 0,
      time: 1322135154,
      hasDetails: true,
      inputs: [{
        prevAddress: '1FwYmGEjXhMtxpWDpUXwLx7ndLNfFQncKq',
        value: 100000000
      }],
      outputs: [{
        address: '14pDqB95GWLWCjFxM4t96H2kXH7QMKSsgG',
        value: 98000000,
        index: 0,
        script: '76a91429d6a3540acfa0a950bef2bfdc75cd51c24390fd88ac'
      },
      {
        address: '13AMPUTTwryLGX3nrMvumaerSqNXkL3gEV',
        value: 2000000,
        index: 1,
        script: '76a91417b5038a413f5c5ee288caa64cfab35a0c01914e88ac'
      }]
    })
  })
})
