
var D = require('../def');
var IndexedDB = require('./database/indexed_db');
var ChainSo = require('./network/chainso');
var Account = require('../account');


var CoinData = function() {
    this._db = new IndexedDB();
    this._network = new ChainSo();
};
module.exports = new CoinData();

CoinData.prototype.getAccounts = function(deviceID, passPhraseID, callback) {
    var that = this;
    that._db.getAccounts(deviceID, passPhraseID, function(error, accounts) {
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

CoinData.prototype.getFloatFee = function(coinType, fee) {
    // TODO get coinType
    return this._network.getFloatFee(fee);
};

CoinData.prototype.initNetwork = function(callback) {
    this._network.initNetwork(D.COIN_BIT_COIN, function(error, response) {
        console.log('init network', D.COIN_BIT_COIN, error, response);
        callback(error);
    });
};

CoinData.prototype.registerListenedTransactionId = function (transactionId, callback) {
    this._network.registerListenedTransactionId(transactionId, callback);
};

CoinData.prototype.registerListenedAddress = function (address, callback) {
    // TODO add listened tx id
    this._network.registerListenedAddress(address, [], callback);
};

CoinData.prototype.listenNewTransactionInfo = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoinData.prototype.listenNewTransactionInfo = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

// TODO remove test data
CoinData.prototype.initTransaction = function (accountID) {
    console.log('initTransaction');
    this._db.saveTransactionInfo(
        {
        accountID: accountID,
        coinType: D.COIN_BIT_COIN,
        txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
        firstConfirmedTime: new Date().getTime(),
        direction: 'in',
        count: 84000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {
            accountID: accountID,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
            firstConfirmedTime: 1524138384000,
            direction: 'out',
            count: 18000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {

            accountID: accountID,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
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