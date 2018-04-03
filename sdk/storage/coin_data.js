var CoinData = function() {
    this._db = new IndexedDB();

    this._blockHeight = -1;
};

CoinData.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    _db.loadAccounts(deviceID, passPhraseID, callback);
};

CoinData.prototype.saveAccount = function(account, callback) {
    _db.saveAccount(account, callback);
};

CoinData.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    _db.getTransactionInfo(accountID, startIndex, endIndex, callback);
};

CoinData.prototype.listenNewTransactionInfo = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

CoinData.prototype.listenNewBlockHeight = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

CoinData.prototype.getBlockHeight = function() {
    if (this._blockHeight === -1) {
        return [ERROR_NETWORK_NOT_INITIALIZED];
    }
    return [ERROR_NO_ERROR, this._blockHeight];
};