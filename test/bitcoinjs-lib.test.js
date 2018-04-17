
var bitcoin = require('bitcoinjs-lib');

console.log(bitcoin.ECPair.makeRandom().toWIF());

$.get( "https://chain.so/api/v2/get_info/DOGE", function( response ) {
    $( "body" )
        .append( "Name: " + response.data.name + "<br/>" ) // Dogecoin
        .append( "Total Blocks: " + response.data.blocks + "</br>"); //  current block count
}, "json" );