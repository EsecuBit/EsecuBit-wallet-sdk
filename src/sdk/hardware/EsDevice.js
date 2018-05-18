
const D = require('../D').class

const EsDevice = function () {
}
module.exports = {class: EsDevice}

EsDevice.prototype.listenPlug = function (callback) {
  setTimeout(() => callback(D.ERROR_NOT_IMPLEMENTED), 0)
}

EsDevice.prototype.sendAndReceive = async function (apdu) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}
