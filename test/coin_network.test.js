
var D = require('../sdk/def');
var ChainSo = require('../sdk/data/network/chainso');

var chainSo = new ChainSo();

chainSo.initNetwork(D.COIN_BIT_COIN, function (error, response) {
    console.log('initNetwork error', error, '\nresponse', response);
   
    // chainSo.queryAddress('1PX3W54f2uEfvLJFi3ncqkhg27QG787VhZ', function (error, response) {
    //    console.log('queryAddress error', error, '\nresponse', response);
    // });
    //
    // chainSo.queryTransaction('2d05f0c9c3e1c226e63b5fac240137687544cf631cd616fd34fd188fc9020866 ', function (error, response) {
    //     console.log('queryTransaction error', error, '\nresponse', response);
    // });

    chainSo.registerListenedAddress('1PX3W54f2uEfvLJFi3ncqkhg27QG787VhZ', [], function(error, response) {
       console.log('registerListenedAddress error', error, '\nresponse', response);
    });
});