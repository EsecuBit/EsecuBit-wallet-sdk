
var ChainSo = require('../sdk/data/network/chainso');

var chainSo = new ChainSo();

chainSo.initNetwork('BTC', function (error, response) {
   console.log('error', error, '\nresponse', response);
});