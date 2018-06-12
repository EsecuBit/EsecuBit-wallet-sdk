
import D from '../D'

export default class IEsDevice {
  async listenPlug (callback) {
    throw D.error.notImplemented
  }

  async sendAndReceive (apdu) {
    throw D.error.notImplemented
  }
}
