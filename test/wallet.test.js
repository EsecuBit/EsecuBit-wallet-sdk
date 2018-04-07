
import Wallet from '../sdk/wallet.js'

let deviceID = "1";
let passPhraseID = "";
let wallet = new Wallet();

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

        let account = accounts[0];
        account.getAddress({}, function (error, address) {
            console.log('getAddress: error: ' + error);
            console.dir(address);
        });
    });
});