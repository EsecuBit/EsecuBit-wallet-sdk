
var D = require('../../../def').class

var BitCoinFeeEarn = function (fee) {
  fee = fee || {}
  this.fee = {}; // santonshi / b
  this.fee[D.FEE_FAST] = fee.hasOwnProperty(D.FEE_FAST)? fee[D.FEE_FAST] : 100
  this.fee[D.FEE_NORMAL] = fee.hasOwnProperty(D.FEE_NORMAL)? fee[D.FEE_NORMAL] : 50
  this.fee[D.FEE_ECNOMIC] = fee.hasOwnProperty(D.FEE_ECNOMIC)? fee[D.FEE_ECNOMIC] : 20

}
module.exports = {class: BitCoinFeeEarn}

var url = 'https://bitcoinfees.earn.com/api/v1/fees/recommended'

BitCoinFeeEarn.prototype.updateFee = function (callback) {
  var that = this
  get(url, function (error) {
    console.warn('request fee failed', url, error)
    callback(D.ERROR_NETWORK_UNVAILABLE)
  }, function (response) {
    /**
     * @param response.fastestFee   Suggested fee(santonshi per b) to confirmed in 1 block.
     * @param response.halfHourFee  Suggested fee(santonshi per b) to confirmed in 3 blocks.
     * @param response.hourFee    Suggested fee(santonshi per b) to confirmed in 6 blocks.
     */
    console.info('update fee succeed', 'old fee', that.fee)
    that.fee[D.FEE_FAST] = response.fastestFee
    that.fee[D.FEE_NORMAL] = response.halfHourFee
    that.fee[D.FEE_ECNOMIC] = response.hourFee
    console.info('new fee', that.fee)
    callback(D.ERROR_NO_ERROR, that.fee)
  })
}

function get(url, errorCallback, callback) {
  var xmlhttp = new XMLHttpRequest()
  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState === 4) {
      if (xmlhttp.status === 200) {
        try {
          var coinInfo = JSON.parse(xmlhttp.responseText)
        } catch (e) {
          console.warn(e)
          errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR)
          return
        }
        callback(coinInfo)
      } else if (xmlhttp.status === 500) {
        console.warn('http get error', url, xmlhttp.status)
        errorCallback(D.ERROR_NETWORK_PROVIDER_ERROR)
      } else {
        console.warn('http get error', url, xmlhttp.status)
        errorCallback(D.ERROR_NETWORK_UNVAILABLE)
      }
    }
  }
  xmlhttp.open('GET', url, true)
  xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
  xmlhttp.send()
}