
const D = require('../../../sdk/D').class
const ChainSo = require('../../../sdk/data/network/ChainSo').class
require('chai').should()

const chainSo = new ChainSo(D.COIN_BIT_COIN_TEST)

// TODO complete test
describe('Network ChainSo Bitcoin', function () {
  this.timeout(5000)

  // server limit
  it('init network', async () => {
    chainSo.init()
  })

  it('query address', async () => {
    await D.wait(1000)
    let response = await chainSo.queryAddress('mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8')
    console.log(response)
    response.address.should.equal('mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8')
    response.total_txs.should.equal(1)
    response.txs[0].txid.should.equal('45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10')
  })
})
