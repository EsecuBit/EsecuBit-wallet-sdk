
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
    console.log(response)
    // response.address.should.equal('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7')
    // response.total_txs.should.equal(1)
    // response.txs[0].txid.should.equal('20a42ecd34af95dc5fd5197f8971f7d9d690f7e456abb8c1f6a6ef6a25b56616')
  })
  it('test2', function (done) {
    blockchainInfo.get('https://blockchain.info/rawtx/b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da?cors=true',
      function (error) {
        error.should.equal(D.ERROR_NO_ERROR)
        done('no')
      }, function (response) {
        console.log(response)
        done()
      })
  })
})
