
var D = require('../def').class;
var IndexedDB = require('./database/indexed_db').class;
var ChainSo = require('./network/chainso').class;
var Account = require('../account').class;

var CoinData = function() {
    this._initialized = false;
    this._db = new IndexedDB();
    this._networkProvider = ChainSo;
    this._network = {};
    this._network[D.COIN_BIT_COIN] = new this._networkProvider();
    this._network[D.COIN_BIT_COIN_TEST] = new this._networkProvider();

    this._listeners = [];
};
module.exports = {instance: new CoinData()};

CoinData.prototype.init = function(callback) {
    if (this._initialized) {
        setTimeout(function () {
            callback(D.ERROR_NO_ERROR);
        }, 0);
        return;
    }

    var initTotal = this._network.length;
    var initCount = 0;
    var failed = false;
    var that = this;
    for (var coinType in this._network) {
        if (!this._network.hasOwnProperty(coinType)) {
            continue;
        }
        (function(coinType) {
            // TODO slow down the request speed
            that._network[coinType].initNetwork(coinType, function(error, response) {
                console.log('init network', coinType, 'error:', error, ', response:', response);
                initCount++;
                if (error !== D.ERROR_NO_ERROR) {
                    failed = true;
                    callback(error);
                }
                if (!failed && initCount === initTotal) {
                    that._initialized = true;
                    callback(D.ERROR_NO_ERROR);
                }

                that._db.getAddressInfos(coinType, function (error, response) {
                    if (error !== D.ERROR_NO_ERROR) {
                        console.warn('getAddressInfos failed, error', error);
                    }
                    for (var i in response) {
                        if (!response.hasOwnProperty(i)) {
                            continue;
                        }
                        that._listenAddress(coinType, response[i].address);
                    }
                });
            });
        })(coinType);
    }
};

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
                accountId: makeID(),
                label: "Account#1",
                deviceID: deviceID,
                passPhraseID: passPhraseID,
                coinType: D.COIN_BIT_COIN
            };
            that._db.saveAccount(firstAccount, function(error, account) {
                if (D.TEST_MODE) {
                    that.initTransaction(firstAccount.accountId);
                }
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
            var newAccount =
                    {
                        accountId: makeID(),
                        label: "Account#" + index,
                        deviceID: deviceID,
                        passPhraseID: passPhraseID,
                        coinType: coinType,
                        balance: 0
                    };
            if (D.TEST_MODE) {
                newAccount.balance = 32000000;
            }
            that._db.saveAccount(newAccount, callback);
            return;
        }

        that.getTransactionInfos(
            {
                accountId: lastAccountInfo.accountId,
                startIndex: 0,
                endIndex: 1
            },
            function (error, transactions) {

                if (transactions.length === 0) {
                    callback(D.ERROR_LAST_WALLET_NO_TRANSACTION);
                    return;
                }
                var index = accounts.length + 1;
                that._db.saveAccount(
                    {
                        accountId: makeID(),
                        label: "Account#" + index,
                        deviceID: deviceID,
                        passPhraseID: passPhraseID,
                        coinType: coinType
                    },
                    callback);
         });
    });
};

CoinData.prototype.getTransactionInfos = function(filter, callback) {
    this._db.getTransactionInfos(filter, callback);
};

CoinData.prototype.getFloatFee = function(coinType, fee) {
    return this._network[coinType].getFloatFee(fee);
};

// won't use
CoinData.prototype._listenTransaction = function (coinType, txId, callback) {
    this._network[coinType].listenTransaction(txId, callback);
};

CoinData.prototype._listenAddress = function (coinType, address, callback) {
    this._db.getTransactionInfos({address: address}, function (error, response) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }

        var listenedTxIds = [];
        for (var i in response) {
            if (!response.hasOwnProperty(i)) {
                continue;
            }
            listenedTxIds.push(response.txId);
        }
        this._network[coinType].listenAddress(address, listenedTxIds, callback);
    });
};

CoinData.prototype.addTransactionListener = function (callback) {
    for (var i in this._listeners) {
        if (!this._listeners.hasOwnProperty(i)) {
            continue;
        }
        if (this._listeners[i] === callback) {
            console.log('addTransactionListener already has this listener', callback);
            return;
        }
    }
    this._listeners.push(callback);
};

CoinData.prototype.initTransaction = function (accountId) {
    console.log('initTransaction');
    this._db.saveTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
            direction: 'in',
            address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
            createTime: new Date().getTime(),
            confirmedTime: new Date().getTime(),
            outIndex: 0,
            script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
            count: 84000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
            direction: 'out',
            address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
            createTime: 1524138384000,
            confirmedTime: 1524138384000,
            count: 18000000
        },
        function() {});

    this._db.saveTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
            address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
            createTime: new Date().getTime(),
            confirmedTime: new Date().getTime(),
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