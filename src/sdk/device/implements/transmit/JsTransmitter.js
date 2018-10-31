import D from '../../../D'
import Settings from '../../../Settings'

/**
 * Transmitter for JsWallet only. Only enabled when D.test.jsWallet = true
 */
export default class JsTransmitter {
  listenPlug (listener) {
    if (D.test.jsWallet) {
      console.info('JsTransmitter plug in, jsWallet enabled')
      D.dispatch(() => listener(D.error.succeed, D.status.plugIn))
    }
  }

  getSeed () {
    return new Settings().getTestSeed()
  }
}
