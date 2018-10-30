import D from '../../../D'
import Settings from '../../../Settings'

/**
 * Transmitter for JsWallet only. Only enabled when D.test.jsWallet = true
 */
export default class JsTransmitter {
  listenPlug (listener) {
    if (D.test.jsWallet) {
      D.dispatch(() => listener(D.error.succeed, D.status.plugIn))
    }
  }

  getSeed () {
    return this.getTestSeed()
  }

  async getTestSeed () {
    while (this.busy) await D.wait(2)
    this.busy = true

    let testSeed = await new Settings().getSetting('testSeed')
    if (!testSeed) {
      testSeed = D.test.generateSeed()
      await this.setTestSeed(testSeed)
    }

    this.busy = false
    return testSeed
  }

  async setTestSeed (testSeed) {
    while (this.busy) await D.wait(2)
    await new Settings().setSetting('testSeed', testSeed)
    this.busy = false
  }
}
