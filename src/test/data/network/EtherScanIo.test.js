
import chai from 'chai'
import D from '../../../sdk/D'
import EtherScanIo from '../../../sdk/data/network/EtherScanIo'

chai.should()
describe('Network BlockChainInfo Bitcoin', function () {
  this.timeout(3000)
  const etherScanIo = new EtherScanIo(D.coin.test.ethRinkeby)

  it('init network', async () => {
    let response = await etherScanIo.init()
    response.should.not.equal(undefined)
  })

  it('query address', async () => {
    let addressInfo = await etherScanIo.queryAddress('0x79c744891902a0319b1322787190efaba5dbea72')
    addressInfo.address.should.equal('0x79c744891902a0319b1322787190efaba5dbea72')
    addressInfo.txCount.should.equal(3)
    let txInfo = addressInfo.txs[0]
    txInfo.txId.should.equal('0x3f0a669b9a103de7cb0f6d6185e1e26e6eaf3e766d5f5c0d1828911c17478819')
    txInfo.blockNumber.should.equal(2441844)
    txInfo.confirmations.should.above(0)
    txInfo.time.should.above(0)
    txInfo.hasDetails.should.equal(true)
    txInfo.inputs.length.should.equal(1)
    txInfo.inputs[0].prevAddress.should.be.a('string')
    txInfo.inputs[0].value.should.above(0)
    txInfo.outputs.length.should.equal(1)
    txInfo.outputs[0].address.should.be.a('string')
    txInfo.outputs[0].value.should.above(0)
    txInfo.inputs[0].value.should.equal(txInfo.outputs[0].value)
  })

  it('query transaction', async () => {
    let txInfo = await etherScanIo.queryTx('0xf44a36b20ba14a2e9c4ea141a7090e26a7a71b7a6e1e26568dd321ff180aff30')
    // TODO not stable
    console.log('2', JSON.stringify(txInfo))
  })
})
