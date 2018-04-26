
var D = require('../../def');

var EarnBitCoinFee = function () {
    var defaultFee = {}; // santonshi / b
    defaultFee[D.FEE_FAST] = 100;
    defaultFee[D.FEE_NORMAL] = 80;
    defaultFee[D.FEE_ECNOMIC] = 20;

    /**
     * @param response.fastestFee   Suggested fee to confirmed in 1 block.
     * @param response.halfHourFee  Suggested fee to confirmed in 3 blocks.
     * @param response.hourFee      Suggested fee to confirmed in 6 blocks.
     */
    var url = 'https://bitcoinfees.earn.com/api/v1/fees/recommended';
    get(url, function (error) {
        console.warn('request fee failed', url, error);
    }, function (response) {
        defaultFee[D.FEE_FAST] = response.fastestFee;
        defaultFee[D.FEE_NORMAL] = response.halfHourFee;
        defaultFee[D.FEE_ECNOMIC] = response.hourFee;
    })
};
module.exports = new EarnBitCoinFee();

function get(url, errorCallback, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
                try {
                    var coinInfo = JSON.parse(xmlhttp.responseText);
                    callback(coinInfo);
                } catch (e) {
                    console.warn(e);
                    errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR);
                }
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
    // TODO application/json?
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xmlhttp.send();
}