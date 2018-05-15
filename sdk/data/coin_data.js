
var D = require('../def').class;
var IndexedDB = require('./database/indexed_db').class;
var ChainSo = require('./network/chain_so').class;
var Account = require('../account').class;

var CoinData = function() {
    this._initialized = false;
    this._db = new IndexedDB();
    // TODO read provider from settings
    this._networkProvider = ChainSo;
    this._network = {};
    this._network[D.COIN_BIT_COIN] = new this._networkProvider();
    this._network[D.COIN_BIT_COIN_TEST] = new this._networkProvider();

    var that = this;
    this._registeredListeners = [];
    this._transactionListener = function (error, transactionInfo) {
        if (error !== D.ERROR_NO_ERROR) {
            return;
        }
        that._db.saveOrUpdateTransactionInfo(transactionInfo, function (error) {
            if (error !== D.ERROR_NO_ERROR) {
                notify();
            }
        });
    };
    this._addressListener = function (error, addressInfo, transactionInfo) {
        if (error !== D.ERROR_NO_ERROR) {
            return;
        }
        notify();
    };

    function notify() {
        for (var i in that._registeredListeners) {
            if (!that._registeredListeners.hasOwnProperty(i)) {
                continue;
            }
            that._registeredListeners[i](response);
        }
    }
};
module.exports = {instance: new CoinData()};

CoinData.prototype.init = function(callback) {
    if (this._initialized) {
        setTimeout(function () {
            callback(D.ERROR_NO_ERROR);
        }, 0);
        return;
    }

    var that = this;
    this._db.init(function (error) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }
        initNetwork();
    });

    function initNetwork () {
        var initTotal = Object.keys(that._network).length;
        var initCount = 0;
        var failed = false;

        function initFinish(error) {
            if (error !== D.ERROR_NO_ERROR && !failed) {
                failed = true;
                callback(error);
            }
            initCount++;
            if (!failed && initCount === initTotal) {
                that._initialized = true;
                sync();
            }
        }

        for (var coinType in that._network) {
            if (!that._network.hasOwnProperty(coinType)) {
                continue;
            }
            (function(coinType) {
                that._network[coinType].init(coinType, function(error, response) {
                    console.log('init network', coinType, ', error:', error, ', response:', response);
                    initFinish(error);
                });
            })(coinType);
        }
    }

    function sync() {
        // TODO read device to sync old transaction before listen new transaction
        // TODO continue update transaction confirmations if confirmations < D.TRANSACTION_##COIN_TYPE##_MATURE_CONFIRMATIONS
        for (var coinType in that._network) {
            (function(coinType) {
                that._db.getAddressInfos({coinType: coinType, type: D.ADDRESS_EXTERNAL}, function (error, response) {
                    if (error !== D.ERROR_NO_ERROR) {
                        console.warn('getAddressInfos failed, error', error);
                        return;
                    }
                    for (var i in response) {
                        if (!response.hasOwnProperty(i)) {
                            continue;
                        }
                        that._listenAddress(response[i], that._addressListener);
                    }
                });
            })(coinType);
        }
        callback(D.ERROR_NO_ERROR);
    }
};

CoinData.prototype.release = function() {
    this._listeners = [];
    for (var i in this._network) {
        if (!this._network.hasOwnProperty(i)) {
            continue;
        }
        this._network[i].release();
    }
};

CoinData.prototype.getAccounts = function(deviceId, passPhraseId, callback) {
    var that = this;
    that._db.getAccounts(deviceId, passPhraseId, function(error, accounts) {
        if (error !== D.ERROR_NO_ERROR) {
            callback(error);
            return;
        }

        if (accounts.length === 0) {
            console.log('no accounts, init the first account');
            // initialize first account
            var firstAccount = {
                accountId: makeId(),
                label: "Account#1",
                deviceId: deviceId,
                passPhraseId: passPhraseId,
                coinType: D.COIN_BIT_COIN,
                balance: 0
            };
            if (D.TEST_MODE) {
                firstAccount.balance = 32000000;
            }
            that._db.saveAccount(firstAccount, function(error, account) {
                if (D.TEST_MODE) {
                    console.log('TEST_MODE add test transactionInfo');

                    that.initTestDbData(firstAccount.accountId);
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

CoinData.prototype.newAccount = function(deviceId, passPhraseId, coinType, callback) {
    var that = this;
    that._db.getAccounts(deviceId, passPhraseId, function (error, accounts) {
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
                        accountId: makeId(),
                        label: "Account#" + index,
                        deviceId: deviceId,
                        passPhraseId: passPhraseId,
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
            function (error, total) {
                if (total === 0) {
                    callback(D.ERROR_LAST_ACCOUNT_NO_TRANSACTION);
                    return;
                }
                var index = accounts.length + 1;
                that._db.saveAccount(
                    {
                        accountId: makeId(),
                        label: "Account#" + index,
                        deviceId: deviceId,
                        passPhraseId: passPhraseId,
                        coinType: coinType,
                        balance: 0
                    },
                    callback);
         });
    });
};

CoinData.prototype.getTransactionInfos = function(filter, callback) {
    this._db.getTransactionInfos(filter, callback);
};

CoinData.prototype.getFloatFee = function(coinType, fee) {
    return D.getFloatFee(coinType, fee);
};

// TODO listen transaction after boardcast a transaction successfully
CoinData.prototype._listenTransaction = function (transactionInfo, callback) {
    this._network[transactionInfo.coinType].listenTransaction(transactionInfo, callback);
};

CoinData.prototype._listenAddress = function (addressInfo, callback) {
    this._network[addressInfo.coinType].listenAddress(addressInfo, callback);
};

CoinData.prototype.addListener = function (callback) {
    for (var i in this._listeners) {
        if (!this._registeredListeners.hasOwnProperty(i)) {
            continue;
        }
        if (this._registeredListeners[i] === callback) {
            console.log('addTransactionListener already has this listener', callback);
            return;
        }
    }
    this._registeredListeners.push(callback);
};

/*
 * Test data in TEST_MODE
 */
CoinData.prototype.initTestDbData = function (accountId) {
    console.log('initTestDbData');
    this._db.saveOrUpdateTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c3',
            address: '1Lhyvw28ERxYJRjAYgntWazfmZmyfFkgqw',
            direction: D.TRANSACTION_DIRECTION_IN,
            time: 1524138384000,
            outIndex: 0,
            script: '76a91499bc78ba577a95a11f1a344d4d2ae55f2f857b9888ac',
            value: 84000000
        },
        function() {});

    this._db.saveOrUpdateTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c4',
            address: '3PfcrxHzT6WuNo7tcqmAdLKn6EvgXCCSiQ',
            direction: D.TRANSACTION_DIRECTION_OUT,
            time: 1524138384000,
            value: 18000000
        },
        function() {});

    this._db.saveOrUpdateTransactionInfo(
        {
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            txId: '574e073f66897c203a172e7bf65df39e99b11eec4a2b722312d6175a1f8d00c5',
            address: '14F7iCA4FsPEYj67Jpme2puVmwAT6VoVEU',
            direction: D.TRANSACTION_DIRECTION_OUT,
            time: 1524138384000,
            value: 34000000
        },
        function() {});

    this._db.saveOrUpdateAddressInfo(
        {
            address: '',
            accountId: accountId,
            coinType: D.COIN_BIT_COIN,
            path: [0x80000000, 0x8000002C, 0x80000000, 0x00000000, 0x00000000],
            type: D.ADDRESS_EXTERNAL,
            txCount: 0,
            balance: 0,
            txIds: []
        },
        function() {});
};

function makeId() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(var i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text;
}