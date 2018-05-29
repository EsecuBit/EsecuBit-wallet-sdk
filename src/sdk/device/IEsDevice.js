
import D from '../D'

const IEsDevice = function () {
}

IEsDevice.prototype.listenPlug = function (callback) {
  setTimeout(() => callback(D.ERROR_NOT_IMPLEMENTED), 0)
}

IEsDevice.prototype.sendAndReceive = async function (apdu) {
  throw D.ERROR_NOT_IMPLEMENTED
}

export default {class: IEsDevice}
