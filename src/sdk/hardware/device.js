
const D = require('../def').class

const Device = function () {
}
module.exports = {class: Device}

Device.prototype.listenPlug = function (callback) {
  setTimeout(() => callback(D.ERROR_NOT_IMPLEMENTED), 0)
}

Device.prototype.sendAndReceive = async function (apdu) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}
