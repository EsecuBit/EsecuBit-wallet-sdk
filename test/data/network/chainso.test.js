
var D = require('../../../sdk/def').class;
var ChainSo = require('../../../sdk/data/network/chainso').class;
var should = require('chai').should();

var chainSo = new ChainSo();

// TODO complete test
describe('Network ChainSo Bitcoin', function() {
    this.timeout(5000);
    it('init network', function (done) {
        chainSo.initk(D.COIN_BIT_COIN, function (error, response) {
            try {
                error.should.equal(D.ERROR_NO_ERROR);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('query address', function (done) {
        setTimeout(function () {
            chainSo.queryAddress('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7', function(error, response) {
               try {
                   error.should.equal(D.ERROR_NO_ERROR);
                   response.address.should.equal('1AjAF7bZvimjdTuPnWLNN3F4WCbzLbuyG7');
                   response.total_txs.should.equal(1);
                   response.txs[0].txid.should.equal('20a42ecd34af95dc5fd5197f8971f7d9d690f7e456abb8c1f6a6ef6a25b56616');
                   done();
               } catch (e) {
                   done(e);
               }
            });
        }, 1000);
    });
});