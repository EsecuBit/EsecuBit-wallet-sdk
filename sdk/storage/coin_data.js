var CoinData = function() {
    this._db = new IndexedDB();
    this._blockHeight = -1;
};

CoinData.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    _db.loadAccounts(deviceID, passPhraseID, function(error, accounts) {
        if (error !== ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        if (accounts === 0) {
            // initialize first account
            var firstAccount = new Account("Account", deviceID, passPhraseID, COIN_BIT_COIN);
            _db.saveAccount(firstAccount, function(error, account) {
                callback(error, [account]);
            });
        }
    });
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