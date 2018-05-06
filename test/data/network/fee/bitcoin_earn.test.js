
var BitCoinEarn = require('../../../../sdk/data/network/fee/bitcoin_earn').class;

var indexedDB = new BitCoinEarn({});
describe('expect', function() {
    it('4 + 5 = 9', function() {
        assert.equal(4 + 5, 9);
    });

    it('deleteAccounts', function() {
        indexedDB.clearAccounts("1", "1", function(error) {
            assert.equal(error, ERROR_NO_ERROR);
        });
    });
});