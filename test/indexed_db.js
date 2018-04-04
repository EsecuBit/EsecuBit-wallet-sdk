
import IndexedDB from 'sdk/data/database/indexed_db';

let indexedDB = new IndexedDB();
indexedDB.clearAccounts("1", "1", function(error) {
    assert.equal(error, ERROR_NO_ERROR);
});