
const D = require('../../../sdk/D').class
const ChainSo = require('../../../sdk/data/network/ChainSo').class
require('chai').should()

const chainSo = new ChainSo()

// TODO complete test
describe('Network ChainSo Bitcoin', function () {
  this.timeout(5000)

  // server limit
  it('init network', async () => {
    chainSo.init(D.COIN_BIT_COIN)
  })

  it('query address', async () => {
    await D.wait(1000)
    let response = await chainSo.queryAddress('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7')
    console.log(response)
    response.address.should.not.equal(undefined)
    response.address.should.equal('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7')
    response.total_txs.should.equal(1)
    response.txs[0].txid.should.equal('20a42ecd34af95dc5fd5197f8971f7d9d690f7e456abb8c1f6a6ef6a25b56616')
  })
})
