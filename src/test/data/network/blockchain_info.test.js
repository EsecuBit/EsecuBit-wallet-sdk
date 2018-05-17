
const D = require('../../../sdk/def').class
const BlockchainInfo = require('../../../sdk/data/network/blockchain_info').class
require('chai').should()

const blockchainInfo = new BlockchainInfo()

// TODO complete test
describe('Network Blockchain Bitcoin', function() {
  this.timeout(5000)
  it('init network', async () => {
    console.log('2')
    let response = await blockchainInfo.init(D.COIN_BIT_COIN)
    response.should.not.equal(undefined)
  })

  // it('query address', function (done) {
  //   blockchainInfo.queryAddress('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7', function(error, response) {
  //     try {
  //       error.should.equal(D.ERROR_NO_ERROR)
  //       response.address.should.equal('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7')
  //       response.total_txs.should.equal(1)
  //       response.txs[0].txid.should.equal('20a42ecd34af95dc5fd5197f8971f7d9d690f7e456abb8c1f6a6ef6a25b56616')
  //       done()
  //     } catch (e) {
  //       done(e)
  //     }
  //   })
  // })
  // it('test', function (done) {
  //   blockchainInfo.get('https://blockchain.info/multiaddr?active=1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7|1j1UHnGwDdJhNf2h3mcFmzGDe2DzoEMuc&cors=true',
  //     function (error) {
  //       error.should.equal(D.ERROR_NO_ERROR)
  //       done('no')
  //     }, function (response) {
  //       console.log(response)
  //       done()
  //     })
  // })
  // it('test2', function (done) {
  //   blockchainInfo.get('https://blockchain.info/rawtx/b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da?cors=true',
  //     function (error) {
  //       error.should.equal(D.ERROR_NO_ERROR)
  //       done('no')
  //     }, function (response) {
  //       console.log(response)
  //       done()
  //     })
  // })
})
