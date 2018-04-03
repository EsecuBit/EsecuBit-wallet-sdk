var DataBase = function() {
};

DataBase.prototype.saveAccount = function(account, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.saveTransactionInfo = function(transactionInfo) {
    callback(ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};