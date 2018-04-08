
var DataBase = function() {
};
module.exports = DataBase;

DataBase.prototype.saveAccount = function(account, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.clearAccounts = function(deviceID, passPhraseID, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.saveTransactionInfo = function(transactionInfo) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

DataBase.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};