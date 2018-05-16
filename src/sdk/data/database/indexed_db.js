
var D = require('../../def').class;
var Database = require('./database').class;

var IndexedDB = function() {
    this._db = null;
};
module.exports = {class: IndexedDB};

IndexedDB.prototype = new Database();

// TODO judge is new app, whether need recover wallet
IndexedDB.prototype.init = function (callback) {
    var that = this;

    if (!('indexedDB' in window)) {
        console.warn('no indexedDB implementation');
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    (function open() {
        var openRequest = indexedDB.open('wallet', 3);
        openRequest.onupgradeneeded = function(e) {
            console.log('indexedDB upgrading...');

            var db = e.target.result;

            /**
             * account:
             * {
             *     accountId: string,
             *     label: string,
             *     deviceID: string,
             *     passPhraseID: string,
             *     coinType: string
             * }
             */
            if(!db.objectStoreNames.contains('account')) {
                var account = db.createObjectStore('account', {autoIncrement: true});
                account.createIndex('deviceId, passPhraseId', ['deviceId', 'passPhraseId'], {unique: false});
                account.createIndex('coinType', 'coinType', {unique: false});
            }

            /**
             * transactionInfo:
             * {
             *     accountId: string,
             *     coinType: string,
             *     txId: string,
             *     blockNumber: 0,
             *     confirmations: int, // just for showing the status. won't active update after confirmations >= D.TRANSACTION_##COIN_TYPE##_MATURE_CONFIRMATIONS
             *     time: long,
             *     direction: D.TRANSACTION_DIRECTION_IN / D.TRANSACTION_DIRECTION_OUT,
             *     inputs: string array [{address, isMine, value}]
             *     outputs: string array [{address, isMine, value}]
             *     value: long (bitcoin -> santoshi) // value that shows the account balance changes, calculated by inputs and outputs
             * }
             */
            // TODO createIndex when upgrade?
            if(!db.objectStoreNames.contains('transactionInfo')) {
                var transactionInfo = db.createObjectStore('transactionInfo', {autoIncrement: true});
                transactionInfo.createIndex('accountId', 'accountId', {unique: false});
                transactionInfo.createIndex('txId', 'txId', {unique: false});
                transactionInfo.createIndex('time', 'time', {unique: false});
            }

            /**
             * addressInfo:
             * {
             *      address: string,
             *      accountId: string,
             *      coinType: string,
             *      path: int array,
             *      type: D.ADDRESS_EXTERNAL / D.ADDRESS_CHANGE,
             *      txCount: int,
             *      balance: long (santoshi),
             *      txs: [{txId, direction, hasSpent, index, script}]
             * }
             */
            if(!db.objectStoreNames.contains('addressInfo')) {
                var addressInfo = db.createObjectStore('addressInfo');
                addressInfo.createIndex('accountId', 'accountId', {unique: false});
                addressInfo.createIndex('coinType', 'coinType', {unique: false});
                addressInfo.createIndex('type', 'type', {unique: false});
                addressInfo.createIndex('accountId, type', ['accountId', 'type'], {unique: false});
                addressInfo.createIndex('coinType, type', ['coinType', 'type'], {unique: false});
            }
        };

        openRequest.onsuccess = function(e) {
            console.log('indexedDB open success!');
            that._db = e.target.result;
            callback(D.ERROR_NO_ERROR);
        };

        openRequest.onerror = function(e) {
            console.log('indexedDB open error', e);
            callback(D.ERROR_DATABASE_OPEN_FAILED);
        };
    })();
};

IndexedDB.prototype.saveAccount = function(account, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readwrite')
        .objectStore('account')
        .add(account);

    request.onsuccess = function() {
        callback(D.ERROR_NO_ERROR, account);
    };
    request.onerror = function(e) {
        console.log('saveAccount', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED, account);
    };
};

IndexedDB.prototype.getAccounts = function(deviceId, passPhraseId, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        // .index('deviceId, passPhraseId')
        .getAll();

    request.onsuccess = function(e) {
        callback(D.ERROR_NO_ERROR, e.target.result);
    };
    request.onerror = function(e) {
        console.log('getAccounts', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED);
    };
};

IndexedDB.prototype.clearAccounts = function(deviceId, passPhraseId, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('deviceId, passPhraseId')
        .delete(deviceId, passPhraseId);

    request.onsuccess = function() {
        callback(D.ERROR_NO_ERROR);
    };
    request.onerror = function(e) {
        console.log('clearAccounts', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED);
    };
};

IndexedDB.prototype.saveOrUpdateTransactionInfo = function(transactionInfo, callback) {
    if (this._db === null) {
        callback(D.ERROR_DATABASE_OPEN_FAILED);
        return;
    }

    var request = this._db.transaction(['transactionInfo'], 'readwrite')
        .objectStore('transactionInfo')
        .add(transactionInfo);

    request.onsuccess = function() { callback(D.ERROR_NO_ERROR, transactionInfo); };
    request.onerror = function(e) {
        console.log('saveOrUpdateTransactionInfo', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED, transactionInfo); };
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
    var total = 0;
    var startIndex = filter.hasOwnProperty('startIndex')? filter.startIndex : 0;
    request.onsuccess = function(e) {
        var cursor = e.target.result;
        if(!cursor) {
            callback(D.ERROR_NO_ERROR, total, array);
            return;
        }
        if (total++ >= startIndex) {
            array.push(cursor.value);
        }
        cursor.continue();
    };
    request.onerror = function(e) {
        console.log('getTransactionInfos', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED);
    };
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
    request.onerror = function(e) {
        console.log('saveOrUpdateAddressInfo', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED, addressInfo);
    };
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
            return;
        }

        array.push(cursor.value);
        cursor.continue();
    };
    request.onerror = function(e) {
        console.warn('getAddressInfos', e);
        callback(D.ERROR_DATABASE_EXEC_FAILED);
    };
};