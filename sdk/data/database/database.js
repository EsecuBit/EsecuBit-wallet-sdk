
var Database = function() {
};
module.exports = {class: Database};

Database.prototype.saveAccount = function(account, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Database.prototype.getAccounts = function(deviceID, passPhraseID, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Database.prototype.clearAccounts = function(deviceID, passPhraseID, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Database.prototype.saveTransactionInfo = function(transactionInfo, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Database.prototype.getTransactionInfos = function(filter, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};