
import chai from 'chai'
import D from '../../../../sdk/D'
import BitCoinEarn from '../../../../sdk/data/network/fee/BitcoinEarn'

chai.should()
describe('BitCoinEarn', function () {
  it('empty BitCoinEarn', function () {
    const bitCoinEarn = new BitCoinEarn()
    bitCoinEarn.fee.should.deep.equal({'fast': 100, 'normal': 50, 'economy': 20})
  })
  it('init BitCoinEarn', function () {
    const initFee = {'fast': 101, 'normal': 65, 'economy': 33}
    const bitCoinEarn = new BitCoinEarn(initFee)
    bitCoinEarn.fee.should.deep.equal(initFee)
  })
  it('update BitCoinEarn', async () => {
    const initFee = {'fast': 0, 'normal': 0, 'economy': 0}
    const bitCoinEarn = new BitCoinEarn(initFee)
    let response = await bitCoinEarn.updateFee()
    console.log(response)
    bitCoinEarn.fee.should.deep.equal(response)
    bitCoinEarn.fee[D.FEE_FAST].should.not.equal(0)
    bitCoinEarn.fee[D.FEE_NORMAL].should.not.equal(0)
    bitCoinEarn.fee[D.FEE_ECNOMIC].should.not.equal(0)
    // noinspection JSUnresolvedFunction
    bitCoinEarn.fee[D.FEE_FAST].should.at.least(bitCoinEarn.fee[D.FEE_NORMAL])
    // noinspection JSUnresolvedFunction
    bitCoinEarn.fee[D.FEE_NORMAL].should.at.least(bitCoinEarn.fee[D.FEE_ECNOMIC])
  })
})
