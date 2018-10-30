import D from '../../../D'

/**
 * Transmitter for JsWallet only. Only enabled when D.test.jsWallet = true
 */
export default class JsTransmitter {
  listenPlug (listener) {
    if (D.test.jsWallet) {
      D.dispatch(() => listener(D.error.succeed, D.status.plugIn))
    }
  }
}