

var should = require('chai').should();

describe('Simple Test', function () {
    it('1 == 1', function () {
        var i = 1;
        i.should.equal(1);
    });
});

var D = require('../../../../sdk/def').class;
var BitCoinEarn = require('../../../../sdk/data/network/fee/bitcoin_earn').class;

describe('BitCoinEarn', function() {
    it('empty BitCoinEarn', function() {
        var bitCoinEarn = new BitCoinEarn({});
        bitCoinEarn.fee.should.deep.equal({'fast': 100, 'normal':50, 'economy': 20});
    });
    it('init BitCoinEarn', function() {
        var initFee = {'fast': 101, 'normal':65, 'economy': 33};
        var bitCoinEarn = new BitCoinEarn(initFee);
        bitCoinEarn.fee.should.deep.equal(initFee);
    });
    it('update BitCoinEarn', function(done) {
        var initFee = {'fast': 0, 'normal':0, 'economy': 0};
        var bitCoinEarn = new BitCoinEarn(initFee);
        bitCoinEarn.updateFee(function (error, response) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                bitCoinEarn.fee.should.deep.equal(response);
                bitCoinEarn.fee[D.FEE_FAST].should.not.equal(0);
                bitCoinEarn.fee[D.FEE_NORMAL].should.not.equal(0);
                bitCoinEarn.fee[D.FEE_ECNOMIC].should.not.equal(0);
                bitCoinEarn.fee[D.FEE_FAST].should.at.least(bitCoinEarn.fee[D.FEE_NORMAL]);
                bitCoinEarn.fee[D.FEE_NORMAL].should.at.least(bitCoinEarn.fee[D.FEE_ECNOMIC]);
            } catch (e) {
                done(e);
            }
        });
    });
    it('#async test', async() => {
        var i = 1;
        i.should.equal(1);
    });
});