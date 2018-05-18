
const D = require('../D').class

const IEsDevice = function () {
}
module.exports = {class: IEsDevice}

IEsDevice.prototype.listenPlug = function (callback) {
  setTimeout(() => callback(D.ERROR_NOT_IMPLEMENTED), 0)
}

IEsDevice.prototype.sendAndReceive = async function (apdu) {
  await D.wait(0)
  throw D.ERROR_NOT_IMPLEMENTED
}
