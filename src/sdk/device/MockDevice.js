
import D from '../D'
import IEsDevice from './IEsDevice'

export default class MockDevice extends IEsDevice {
  constructor () {
    super()
    this.currentAddressIndex = 0
  }
  listenPlug (callback) {
    setTimeout(() => {
      callback(D.error.succeed, D.status.plugIn)
      // setTimeout(function () {
      //   callback(D.error.succeed, D.status.plugIn)
      // }, 2000)
    }, 500)
  }

  async sendAndReceive (apdu) {
    if (D.toHex(apdu) === '00040084000008') {
      return D.toBuffer('020304a6cdf151561a61039000000000')
    }
  }
}
