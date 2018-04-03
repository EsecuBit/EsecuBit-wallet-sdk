var Storage = function() {
    this._blockHeight = 0;
};

Storage.prototype.loadAccounts = function(passPhraseID, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Storage.prototype.saveAccount = function(account, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Storage.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Storage.prototype.listenNewTransactionInfo = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Storage.prototype.listenNewBlockHeight = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Storage.prototype.getBlockHeight = function() {
    return this._blockHeight;
};