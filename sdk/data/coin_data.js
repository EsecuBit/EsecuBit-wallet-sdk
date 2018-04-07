
import * as D from '../def.js'
import IndexedDB from './database/indexed_db.js';
import Account from '../account.js'

let CoinData = function() {
    this._db = new IndexedDB();
    this._blockHeight = -1;
};
export default CoinData;

CoinData.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    let _db = this._db;
    _db.loadAccounts(deviceID, passPhraseID, function(error, accounts) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }

        if (accounts.length === 0) {
            console.log('no accounts, init the first account');
            // initialize first account
            let firstAccount = new Account({
                accountID: makeID(),
                label: "Account#1",
                deviceID: deviceID,
                passPhraseID: passPhraseID,
                coinType: D.COIN_BIT_COIN});
            console.dir(firstAccount);
            _db.saveAccount(firstAccount, function(error, account) {
                console.log(error + ' ' + account);
                callback(error, [new Account(account)]);
            });
            return;
        }

        let objAccounts = [];
        for (let account of accounts) {
            objAccounts.push(new Account(account));
        }
        callback(error, objAccounts);
    });
};

CoinData.prototype.newAccount = function(deviceID, passPhraseID, coinType, callback) {
    let _db = this._db;
    _db.loadAccounts(deviceID, passPhraseID, function (error, accounts) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        let index = accounts.length + 1;
        _db.saveAccount(
            {label: "Account#" + index, deviceID:deviceID, passPhraseID: passPhraseID, coinType: coinType},
            callback);
    });
};

CoinData.prototype.getTransactionInfo = function(accountID, startIndex, endIndex, callback) {
    this._db.getTransactionInfo(accountID, startIndex, endIndex, callback);
};

CoinData.prototype.listenNewTransactionInfo = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoinData.prototype.listenNewBlockHeight = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoinData.prototype.getBlockHeight = function() {
    if (this._blockHeight === -1) {
        return [D.ERROR_NETWORK_NOT_INITIALIZED];
    }
    return [D.ERROR_NO_ERROR, this._blockHeight];
};

function makeID() {
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text;
}