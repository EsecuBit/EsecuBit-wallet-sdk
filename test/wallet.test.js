
var Wallet = require('../sdk/wallet');

var deviceID = "1";
var passPhraseID = "";
var wallet = new Wallet();

wallet.listenDevice(function (error, isPlugIn) {
    console.log('listenDevice: error: ' + error + ', isPlugIn ' + isPlugIn);

    if (!isPlugIn) {
        console.log('plug out');
        return;
    }

    console.log('device plug in');
    wallet.getAccounts(deviceID, passPhraseID, function (error, accounts) {
        console.log('getAccounts: error: ' + error);
        console.dir(accounts);

        var account = accounts[0];
        account.getAddress({}, function (error, address) {
            console.log('getAddress: error: ' + error);
            console.dir(address);
        });
    });
});