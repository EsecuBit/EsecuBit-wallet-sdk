
require('sdk');

var assert = require('chai').assert;

var indexedDB = new IndexedDB();
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