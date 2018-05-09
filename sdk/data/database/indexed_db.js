
var D = require('../../def').class;
var Database = require('./database').class;

var IndexedDB = function() {
    this._db = null;

    var that = this;

    if (!('indexedDB' in window)) {
        console.warn('no indexedDB implementation');
        return;
    }

    if (D.TEST_MODE) {
        var deleteRequest = indexedDB.deleteDatabase('wallet');
        deleteRequest.onsuccess = function (ev) {
            console.log('TEST_MODE indexedDB delete succeed');
            open();
        };
    } else {
        open();
    }

    function open() {
        var openRequest = indexedDB.open('wallet', 3);
        openRequest.onupgradeneeded = function(e) {
            console.log('indexedDB upgrading...');

            var db = e.target.result;

            if(!db.objectStoreNames.contains('account')) {
                var account = db.createObjectStore('account', {autoIncrement: true});
                account.createIndex('deviceID, passPhraseID', ['deviceID', 'passPhraseID'], {unique: false});
                account.createIndex('coinType', 'coinType', {unique: false});
            }

            /**
             * {
             *    accountId: string,
             *    coinType: string,
             *    txId: string,
             *    createTime: long,
             *    confirmedTime: long,
             *    direction: 'in' / 'out',
             *    count: long (santoshi)
             * }
             */
            if(!db.objectStoreNames.contains('transactionInfo')) {
                var transactionInfo = db.createObjectStore('transactionInfo', {autoIncrement: true});
                transactionInfo.createIndex('accountId', 'accountId', {unique: false});
                transactionInfo.createIndex('txId', 'txId', {unique: false});
                transactionInfo.createIndex('createTime', 'createTime', {unique: false});
            }

            /**
             * {
             *      address: string,
             *      accountId: string,
             *      coinType: string,
             *      path: string,
             *      type: 'receive' / 'change'
             *      txCount: int,
             *      balance: long (santoshi)
             * }
             */
            if(!db.objectStoreNames.contains('addressInfo')) {
                var addressInfo = db.createObjectStore('addressInfo');
                addressInfo.createIndex('accountId', 'accountId', {unique: false});
                addressInfo.createIndex('coinType', 'coinType', {unique: false});
                addressInfo.createIndex('accountId, type', ['accountId', 'type'], {unique: false});
            }
        };

        openRequest.onsuccess = function(e) {
            console.log('indexedDB open success!');
            that._db = e.target.result;
        };

        openRequest.onerror = function(e) {
            console.log('indexedDB open error');
            console.dir(e);
        };
    }
};
module.exports = {class: IndexedDB};

IndexedDB.prototype = new Database();
IndexedDB.prototype.saveAccount = function(account, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }
    var request = this._db.transaction(['account'], 'readwrite')
        .objectStore('account')
        .add(account);

    request.onsuccess = function(e) { callback(D.ERROR_NO_ERROR, account); };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED, account); };
};

IndexedDB.prototype.getAccounts = function(deviceID, passPhraseID, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('deviceID, passPhraseID')
        .getAll([deviceID, passPhraseID]);

    request.onsuccess = function(e) {
        callback(D.ERROR_NO_ERROR, e.target.result);
    };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED); };
};

IndexedDB.prototype.clearAccounts = function(deviceID, passPhraseID, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('deviceID, passPhraseID')
        .delete(deviceID, passPhraseID);

    request.onsuccess = function(e) {
        callback(D.ERROR_NO_ERROR);
    };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED); };
};

IndexedDB.prototype.saveTransactionInfo = function(transactionInfo, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['transactionInfo'], 'readwrite')
        .objectStore('transactionInfo')
        .add(transactionInfo);

    request.onsuccess = function(e) { callback(D.ERROR_NO_ERROR, transactionInfo); };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED, transactionInfo); };
};

IndexedDB.prototype.getTransactionInfos = function(filter, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request;
    if (filter.accountId !== null) {
        // var range = IDBKeyRange.bound(startIndex, endIndex);
        request = this._db.transaction(['transactionInfo'], 'readonly')
            .objectStore('transactionInfo')
            .index('accountId')
            .openCursor(filter.accountId);
        // TODO optimize
        // .openCursor(range);
    } else {
        request = this._db.transaction(['transactionInfo'], 'readonly')
            .objectStore('transactionInfo')
            .openCursor();
    }

    var array = [];
    var count = 0;
    var startIndex = filter.hasOwnProperty('startIndex')? filter.startIndex : 0;
    request.onsuccess = function(e) {
        var cursor = e.target.result;
        if(cursor) {
            if (count++ >= startIndex) {
                array.push(cursor.value);
            }
            cursor.continue();
        } else {
            callback(D.ERROR_NO_ERROR, count, array);
        }
    };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED); };
};

IndexedDB.prototype.saveOrUpdateAddressInfo = function(addressInfo, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['addressInfo'], 'readwrite')
        .objectStore('addressInfo')
        .add(addressInfo, addressInfo.address);

    request.onsuccess = function(e) { callback(D.ERROR_NO_ERROR, addressInfo); };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED, addressInfo); };
};

IndexedDB.prototype.getAddressInfos = function(filter, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request;
    if (filter.coinType !== null) {
        request = this._db.transaction(['addressInfo'], 'readonly')
            .objectStore('addressInfo')
            .index('coinType')
            .openCursor(filter.coinType);
    } else {
        request = this._db.transaction(['addressInfo'], 'readonly')
            .objectStore('addressInfo')
            .openCursor();
    }

    var array = [];
    request.onsuccess = function(e) {
        var cursor = e.target.result;
        if(!cursor) {
            callback(D.ERROR_NO_ERROR, array);
        }

        array.push(cursor.value);
        cursor.continue();
    };
    request.onerror = function(e) { callback(D.ERROR_DATABASE_EXEC_FAILED); };
};