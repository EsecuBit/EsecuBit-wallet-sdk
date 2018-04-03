

var IndexedDB = function() {
    this._db = null;

    var _thisRef = this;

    if (!('indexedDB' in window)) {
        console.warn("no indexedDB implementation");
        return;
    }

    var openRequest = indexedDB.open("wallet", 1);
    openRequest.onupgradeneeded = function(e) {
        console.log("indexedDB upgrading...");

        var db = e.target.result;

        if(!db.objectStoreNames.contains("account")) {
            var account = db.createObjectStore("account", {autoIncrement: true});
            account.createIndex("deviceID, passPhraseID", ["deviceID", "passPhraseID"], {unique: false});
            account.createIndex("coinType", "coinType", {unique: false});
        }

        if(!db.objectStoreNames.contains("transactionInfo")) {
            var transactionInfo = db.createObjectStore("transactionInfo", {autoIncrement: true});
            account.createIndex("accountID", "accountID", {unique: false});
            account.createIndex("firstConfirmedTime", "firstConfirmedTime", {unique: false});
        }
    };

    openRequest.onsuccess = function(e) {
        console.log("indexedDB open success!");
        _thisRef._db =db;
    };

    openRequest.onerror = function(e) {
        console.log("indexedDB open error");
        console.dir(e);
    };
};

IndexedDB.prototype = new DataBase();

IndexedDB.prototype.saveAccount = function(account, callback) {
    if (this._db === null) {
        callback(ERROR_OPEN_DATABASE_FAILED);
        return;
    }
    var request = this._db.transaction(["account"], "write")
        .objectStore("account")
        .add(account);

    request.onsuccess = function(e) { callback(ERROR_NO_ERROR, account) };
    request.onerror = function(e) { callback(ERROR_EXEC_DATABASE_FAILED, account) };
};

IndexedDB.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    if (this._db === null) {
        callback(ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request = this._db.transaction(["account"], "read")
        .objectStore("account")
        .index("deviceID, passPhraseID")
        .get(deviceID, passPhraseID);

    request.onsuccess = function(e) { callback(ERROR_NO_ERROR, e.target.result) };
    request.onerror = function(e) { callback(ERROR_EXEC_DATABASE_FAILED) };
};

IndexedDB.prototype.saveTransactionInfo = function(transactionInfo) {
    if (this._db === null) {
        callback(ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var request = this._db.transaction(["transactionInfo"], "write")
        .objectStore("transactionInfo")
        .add(transactionInfo);

    request.onsuccess = function(e) { callback(ERROR_NO_ERROR, transactionInfo) };
    request.onerror = function(e) { callback(ERROR_EXEC_DATABASE_FAILED, transactionInfo) };
};

IndexedDB.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    if (this._db === null) {
        callback(ERROR_OPEN_DATABASE_FAILED);
        return;
    }

    var range = IDBKeyRange.bound(startIndex, endIndex);
    var request = this._db.transaction(["transactionInfo"], "read")
        .objectStore("transactionInfo")
        .index("accountID")
        .openCursor(range);

    request.onsuccess = function(e) {
        var cursor = e.target.result;
        var array = [];
        if(cursor) {
            array.add(cursor.value);
            console.log(cursor.key + ":");
            for(var field in cursor.value) {
                console.log(cursor.value[field]);
            }
            cursor.continue();
        }
        callback(ERROR_NO_ERROR, array);
    };
    request.onerror = function(e) { callback(ERROR_EXEC_DATABASE_FAILED) };
};