
import chai from 'chai'
import D from '../../../../sdk/D'
import BitCoinEarn from '../../../../sdk/data/network/fee/FeeBitCoinEarn'

chai.should()
describe('FeeBitCoinEarn', function () {
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
    bitCoinEarn.fee[D.fee.fast].should.not.equal(0)
    bitCoinEarn.fee[D.fee.normal].should.not.equal(0)
    bitCoinEarn.fee[D.fee.economic].should.not.equal(0)
    // noinspection JSUnresolvedFunction
    bitCoinEarn.fee[D.fee.fast].should.at.least(bitCoinEarn.fee[D.fee.normal])
    // noinspection JSUnresolvedFunction
    bitCoinEarn.fee[D.fee.normal].should.at.least(bitCoinEarn.fee[D.fee.economic])
  })
})
