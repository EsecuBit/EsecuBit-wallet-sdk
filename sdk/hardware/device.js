
import * as D from '../def.js'

let Device = function() {
    this.isPlugedIn = false;
};

Device.prototype.listenPlug = function(callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};

Device.prototype.sendAndReceive = function(apdu, callback) {
    callback(D.ERROR_NOT_IMPLEMENTED);
};