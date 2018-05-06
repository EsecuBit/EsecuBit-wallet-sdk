

var chai = require('chai');
var should = chai.should();
var assert = require('assert');

describe('simple test', function () {
    it('1 == 1', function () {
        var i = 1;
        i.should.equal(1);
    });
});

var D = require('../../../../sdk/def').class;
var BitCoinEarn = require('../../../../sdk/data/network/fee/bitcoin_earn').class;

describe('expect', function() {
    it('empty bitCoinEarn', function() {
        var bitCoinEarn = new BitCoinEarn({});
        bitCoinEarn.fee.should.deep.equal({'fast': 100, 'normal':80, 'economy': 20});
    });
    it('init bitCoinEarn', function() {
        var initFee = {'fast': 101, 'normal':65, 'economy': 33};
        var bitCoinEarn = new BitCoinEarn(initFee);
        bitCoinEarn.fee.should.deep.equal(initFee);
    });
    it('update bitCoinEarn', function(done) {
        var initFee = {'fast': 0, 'normal':0, 'economy': 0};
        var bitCoinEarn = new BitCoinEarn(initFee);
        bitCoinEarn.updateFee(function (error, response) {
            if (error !== D.ERROR_NO_ERROR) {
                done(error);
                return;
            }
            bitCoinEarn.fee.should.deep.equal(response);
            bitCoinEarn.fee[D.FEE_FAST].should.not.equal(0);
            bitCoinEarn.fee[D.FEE_NORMAL].should.not.equal(0);
            bitCoinEarn.fee[D.FEE_ECNOMIC].should.not.equal(0);
            bitCoinEarn.fee[D.FEE_FAST].should.at.least(0);
            done();
        });
    });
});