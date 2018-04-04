
import IndexedDB from '../sdk/data/database/indexed_db';
import assert from 'node_modules/chai/register-assert';

let indexedDB = new IndexedDB();
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