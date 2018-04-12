
var D = require('../def');
var IndexedDB = require('./database/indexed_db');
var Account = require('../account');

var CoinData = function() {
    this._db = new IndexedDB();
    this._blockHeight = -1;
};
module.exports = new CoinData();

CoinData.prototype.loadAccounts = function(deviceID, passPhraseID, callback) {
    var that = this;
    that._db.loadAccounts(deviceID, passPhraseID, function(error, accounts) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }

        if (accounts.length === 0) {
            console.log('no accounts, init the first account');
            // initialize first account
            var firstAccount = {
                accountID: makeID(),
                label: "Account#1",
                deviceID: deviceID,
                passPhraseID: passPhraseID,
                coinType: D.COIN_BIT_COIN
            };
            that._db.saveAccount(firstAccount, function(error, account) {
                // TODO remove
                that.initTransaction(firstAccount.accountID);
                callback(error, [new Account(account)]);
            });
            return;
        }

        var objAccounts = [];
        for (var index in accounts) {
            if (accounts.hasOwnProperty(index)) {
                objAccounts.push(new Account(accounts[index]));
            }
        }
        callback(error, objAccounts);
    });
};

CoinData.prototype.newAccount = function(deviceID, passPhraseID, coinType, callback) {
    var that = this;
    that._db.loadAccounts(deviceID, passPhraseID, function (error, accounts) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }

        // check whether the last spec coinType account has transaction
        var lastAccountInfo = null;
        for (var index in accounts) {
            if (!accounts.hasOwnProperty(index)) {
                continue;
            }
            if (accounts[index].coinType === coinType) {
                lastAccountInfo = accounts[index];
            }
        }

        if (lastAccountInfo === null) {
            that._db.saveAccount(
                {
                    accountID: makeID(),
                    label: "Account#" + index,
                    deviceID: deviceID,
                    passPhraseID: passPhraseID,
                    coinType: coinType,
                    // TODO remove
                    balance: 32000000
                },
                callback);
            return;
        }

        that.getTransactionInfos(
            lastAccountInfo.accountID, 0, 1,
            function (error, transactions) {

                if (transactions.length === 0) {
                    callback(D.ERROR_LAST_WALLET_NO_TRANSACTION);
                    return;
                }
                var index = accounts.length + 1;
                that._db.saveAccount(
                    {
                        accountID: makeID(),
                        label: "Account#" + index,
                        deviceID: deviceID,
                        passPhraseID: passPhraseID,
                        coinType: coinType
                    },
                    callback);
         });
    });
};

CoinData.prototype.getTransactionInfos = function(accountID, startIndex, endIndex, callback) {
    this._db.getTransactionInfos(accountID, startIndex, endIndex, callback);
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

// TODO remove
CoinData.prototype.initTransaction = function (accountID) {
    console.log('initTransaction');
    this._db.saveTransactionInfo(
        {
        accountID: accountID,
        coinType: D.COIN_BIT_COIN,
        firstConfirmedTime: new Date().getTime(),
        direction: 'in',
        count: 84000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {
        accountID: accountID,
        coinType: D.COIN_BIT_COIN,
        firstConfirmedTime: new Date().getTime(),
        direction: 'out',
        count: 18000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {

            accountID: accountID,
            coinType: D.COIN_BIT_COIN,
            firstConfirmedTime: new Date().getTime(),
            direction: 'out',
            count: 34000000
        },
        function() {});
};

function makeID() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(var i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text;
}