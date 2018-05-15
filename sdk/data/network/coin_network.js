
var D = require('../../def').class;

var TYPE_ADDRESS = 'address';
var TYPE_TRANSACTION_INFO = 'transaction_info';
// TODO check block height to restart request
var ADDRESS_REQUEST_PERIOD = 600; // seconds per request
var TRANSACTION_REQUEST_PERIOD = 600; // seconds per request

if (D.TEST_MODE) {
    ADDRESS_REQUEST_PERIOD = 5; // seconds per request
    TRANSACTION_REQUEST_PERIOD = 10; // seconds per request
}

var CoinNetwork = function() {
    this.startQueue = false;
    this.coinType = 'undefined';
    this._blockHeight = -1;
    this._requestRate = 2; // seconds per request
    this._requestList = [];

    var that = this;
    this._queue = function() {
        var timeStamp = new Date().getTime();
        for (var index in that._requestList) {
            if (!that._requestList.hasOwnProperty(index)) {
                continue;
            }
            var request = that._requestList[index];
            console.warn('compare', request.nextTime, timeStamp);
            if (request.nextTime <= timeStamp) {
                request.request();
                break;
            }
        }
        if (that.startQueue) {
            setTimeout(that._queue, that._requestRate * 1000);
        }
    };
};
module.exports = {class: CoinNetwork};

CoinNetwork.prototype.provider = 'undefined';
CoinNetwork.prototype.website = 'undefined';

CoinNetwork.prototype.get = function (url, errorCallback, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
                try {
                    var coinInfo = JSON.parse(xmlhttp.responseText);
                } catch (e) {
                    console.warn(e);
                    errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
                    return;
                }
                callback(coinInfo);
            } else if (xmlhttp.status === 500) {
                console.warn(url, xmlhttp.status);
                errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
            } else {
                console.warn(url, xmlhttp.status);
                errorCallback(D.ERROR_NETWORK_UNVAILABLE);
            }
        }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xmlhttp.send();
};

CoinNetwork.prototype.post = function (url, args, errorCallback, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
                try {
                    var coinInfo = JSON.parse(xmlhttp.responseText);
                } catch (e) {
                    console.warn(e);
                    errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
                    return;
                }
                callback(coinInfo);
            } else if (xmlhttp.status === 500) {
                console.warn(url, xmlhttp.status);
                errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
            } else {
                console.warn(url, xmlhttp.status);
                errorCallback(D.ERROR_NETWORK_UNVAILABLE);
            }
        }
    };
    xmlhttp.open('POST', url, true);
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xmlhttp.send(args);
};

/**
 * listen transaction confirm status
 */
CoinNetwork.prototype.listenTransaction = function (transactionInfo, callback) {
    var that = this;
    this._requestList.push({
        type: TYPE_TRANSACTION_INFO,
        transactionInfo: transactionInfo,
        nextTime: new Date().getTime(),
        request: function() {
            var thatRequest = this;
            that.queryTransaction(thatRequest.transactionInfo.txId, function(error, response) {
                if (error !== D.ERROR_NO_ERROR) {
                    callback(error);
                    return;
                }
                thatRequest.transactionInfo.confirmations = response.confirmations;
                if (response.confirmations >= D.TRANSACTION_BTC_MATURE_CONFIRMATIONS) {
                    console.info('confirmations enough, remove', thatRequest);
                    remove(that._requestList, indexOf(that._requestList, thatRequest));
                }
                callback(error, thatRequest.transactionInfo);
            });
            thatRequest.nextTime = new Date().getTime() + TRANSACTION_REQUEST_PERIOD * 1000;
        }
    });
};

/**
 * listen new transaction from specific address
 */
CoinNetwork.prototype.listenAddress = function (addressInfo, callback) {
    var that = this;
    this._requestList.push({
        type: TYPE_ADDRESS,
        addressInfo: addressInfo,
        nextTime: new Date().getTime(),
        request: function() {
            var thatRequest = this;
            that.queryAddress(thatRequest.addressInfo.address, function(error, response) {
                if (error !== D.ERROR_NO_ERROR) {
                    callback(error);
                    return;
                }
                for (var index in response.txs) {
                    if (!response.txs.hasOwnProperty(index)) {
                        continue;
                    }
                    // TODO wrap response as the same
                    var txId = response.txs[index].txId;
                    if (!isInArray(thatRequest.addressInfo.listenedTxIds, txId)) {
                        thatRequest.listenedTxIds.push(tx.txId);
                        var transactionInfo = {
                            accountId: thatRequest.addressInfo.accountId,
                            coinType: thatRequest.addressInfo.coinType,
                            txId: tx.txId,
                            confirmations: response.txs[index].confirmations,
                            time: tx.time,
                            direction: D.TRANSACTION_DIRECTION_IN,
                            value: long (santoshi)
                        };
                        callback(D.ERROR_NO_ERROR, addressInfo, transactionInfo);
                    }
                }
                thatRequest.nextTime = new Date().getTime() + ADDRESS_REQUEST_PERIOD * 1000;
            });
        }
    });
};

CoinNetwork.prototype.clearListener = function () {
    this._requestList = [];
};

// TODO recovery transaction

function isInArray(arr,value){
    for(var i = 0; i < arr.length; i++){
        if(value === arr[i]){
            return true;
        }
    }
    return false;
}

CoinNetwork.prototype.init = function (coinType, callback) {
    this.startQueue = true;
    // start the request loop
    setTimeout(this._queue, this._requestRate * 1000);
    setTimeout(function () {
        callback(D.ERROR_NO_ERROR);
    }, 0);
};

CoinNetwork.prototype.release = function () {
    this.startQueue = false;
};

/**
 * callback(error, response)
 * response:
 * {
 *      address: string,
 *      balance: 0,
 *      txCount: int,
 *      txs: tx array
 * }
 *
 * tx: see queryTransaction
 *
 */
CoinNetwork.prototype.queryAddress = function (address, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

/**
 *
 * tx:
 * {
 *      txId: string,
 *      version: int,
 *      blockNumber: int,
 *      confirmations: int,
 *      lockTime: long
 *      time: long,
 *      hasDetails: bool,   // for queryAddress only, whether the tx has inputs and outputs. e.g. blockchain.info -> true, chain.so -> false
 *      intputs: [{address, value(bitcoin -> santoshi)}],
 *      outputs: [{address, value(bitcoin -> santoshi)}, index, script]
 * }
 *
 */
CoinNetwork.prototype.queryTransaction = function (txId, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoinNetwork.prototype.getSuggestedFee = function (feeType, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

CoinNetwork.prototype.sendTrnasaction = function (rawTransaction, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

function indexOf(arr, val) {
    for(var i = 0; i < arr.length; i++) {
        if(arr[i] === val) {
            return i;
        }
    }
    return -1;
}

function remove(arr, val) {
    var index = indexOf(val);
    if(index > -1) {
        arr.splice(index,1);
    }
}
