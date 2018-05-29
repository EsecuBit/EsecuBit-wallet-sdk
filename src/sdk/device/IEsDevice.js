
import D from '../D'

export default class IEsDevice {
  async listenPlug (callback) {
    throw D.ERROR_NOT_IMPLEMENTED
  }

  async sendAndReceive (apdu) {
    throw D.ERROR_NOT_IMPLEMENTED
  }
}
