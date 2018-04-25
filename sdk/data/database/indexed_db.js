
var D = require('../../def');

var IndexedDB = function() {
    this._db = null;

    var that = this;

    if (!('indexedDB' in window)) {
        console.warn('no indexedDB implementation');
        return;
    }

    var openRequest = indexedDB.open('wallet', 2);
    openRequest.onupgradeneeded = function(e) {
        console.log('indexedDB upgrading...');

        var db = e.target.result;

        if(!db.objectStoreNames.contains('account')) {
            var account = db.createObjectStore('account', {autoIncrement: true});
            account.createIndex('deviceID, passPhraseID', ['deviceID', 'passPhraseID'], {unique: false});
            account.createIndex('coinType', 'coinType', {unique: false});
        }

        if(!db.objectStoreNames.contains('transactionInfo')) {
            var transactionInfo = db.createObjectStore('transactionInfo', {autoIncrement: true});
            transactionInfo.createIndex('accountID', 'accountID', {unique: false});
            transactionInfo.createIndex('firstConfirmedTime', 'firstConfirmedTime', {unique: false});
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
};
module.exports = IndexedDB;

IndexedDB.prototype.saveAccount = function(account, callback) {
    if (this._db === null) {
        callback(D.ERROR_OPEN_DATABASE_FAILED);
        return;
    }
    var request = this._db.transaction(['account'], 'readwrite')
        .objectStore('account')
        .add(account);

    request.onsuccess = function(e) { callback(D.ERROR_NO_ERROR, account); };
    request.onerror = function(e) { callback(D.ERROR_EXEC_DATABASE_FAILED, account); };
};

IndexedDB.prototype.getAccounts = function(deviceID, passPhraseID, callback) {
    if (this._db === null) {
        callback(D.ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('deviceID, passPhraseID')
        .getAll([deviceID, passPhraseID]);

    request.onsuccess = function(e) {
        callback(D.ERROR_NO_ERROR, e.target.result);
    };
    request.onerror = function(e) { callback(D.ERROR_EXEC_DATABASE_FAILED); };
};

// won't use
IndexedDB.prototype.clearAccounts = function(deviceID, passPhraseID, callback) {
    if (this._db === null) {
        callback(D.ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('deviceID, passPhraseID')
        .delete(deviceID, passPhraseID);

    request.onsuccess = function(e) {
        callback(D.ERROR_NO_ERROR);
    };
    request.onerror = function(e) { callback(D.ERROR_EXEC_DATABASE_FAILED); };
};

IndexedDB.prototype.saveTransactionInfo = function(transactionInfo, callback) {
    if (this._db === null) {
        callback(D.ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request = this._db.transaction(['transactionInfo'], 'readwrite')
        .objectStore('transactionInfo')
        .add(transactionInfo);

    request.onsuccess = function(e) { callback(D.ERROR_NO_ERROR, transactionInfo); };
    request.onerror = function(e) { callback(D.ERROR_EXEC_DATABASE_FAILED, transactionInfo); };
};

IndexedDB.prototype.getTransactionInfos = function(accountID, startIndex, endIndex, callback) {
    if (this._db === null) {
        callback(D.ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request;
    if (accountID === null) {
        request = this._db.transaction(['transactionInfo'], 'readonly')
            .objectStore('transactionInfo')
            .openCursor();
    } else {
        // var range = IDBKeyRange.bound(startIndex, endIndex);
        request = this._db.transaction(['transactionInfo'], 'readonly')
            .objectStore('transactionInfo')
            .index('accountID')
            .openCursor(accountID);
        // TODO optimize
        // .openCursor(range);
    }

    var array = [];
    var count = 0;
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
    request.onerror = function(e) { callback(D.ERROR_EXEC_DATABASE_FAILED); };
};