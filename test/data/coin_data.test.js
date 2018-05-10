
var D = require('../../sdk/def').class;
var coinData = require('../../sdk/data/coin_data').instance;
var should = require('chai').should();

describe('Coin Data', function () {
    it('init', function (done) {
        coinData.init(function (error) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                done();
            } catch (e) {
                done(e)
            }
        });
    });
    it('init again', function (done) {
        coinData.init(function (error) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                done();
            } catch (e) {
                done(e)
            }
        });
    });
    it('init again again', function (done) {
        coinData.init(function (error) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('getAccounts', function (done) {
        coinData.getAccounts(function (error) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                done();
            } catch (e) {
                done(e)
            }
        });
    });
});