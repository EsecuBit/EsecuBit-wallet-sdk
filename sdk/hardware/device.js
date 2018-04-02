var Device = function() {
    this.isPlugedIn = false;
};

Device.prototype.listenPlug = function(callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};

Device.prototype.sendAndReceive = function(apdu, callback) {
    callback(ERROR_NOT_IMPLEMENTED);
};