
var D = require('../def').class

var Device = function() {
}

Device.prototype.listenPlug = function(callback) {
  callback(D.ERROR_NOT_IMPLEMENTED)
}

Device.prototype.sendAndReceive = function(apdu, callback) {
  callback(D.ERROR_NOT_IMPLEMENTED)
}

module.exports = {class: Device}