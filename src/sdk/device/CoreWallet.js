import Provider from '../Provider'
import D from '../D'

export default class CoreWallet {
  async init () {
    this._externlistener = () => {}
  }

  listenPlug (listener) {
    this._externlistener = listener || this._externlistener

    for (let Transmitter of Provider.Transmitters) {
      let transmitter = new Transmitter()
      let plugInListener = (error, status) => {
        if (error !== D.error.succeed) {
          D.dispatch(() => this._externlistener(D.error.succeed, status))
          return
        }
        try {
          this._wallet = CoreWallet._findWallet()
          D.dispatch(() => this._externlistener(D.error.succeed, status))
        } catch (e) {
          D.dispatch(() => this._externlistener(e, status))
        }
      }
      transmitter.listenPlug(plugInListener)
    }
  }

  static _findWallet (transmitter) {
    for (let Wallet of Provider.Wallets) {
      let wallet = new Wallet(transmitter)
      if (wallet.test(transmitter)) {
        return wallet
      }
    }
    console.warn('no suitable wallet found', transmitter, Provider.Wallets)
    throw D.error.deviceProtocol
  }

  async verifyPin () {
    if (!this._wallet) {
      console.warn('no wallet implementation found')
      throw D.error.deviceNotInit
    }
    return this._wallet.verifyPin()
  }

  async getWalletInfo () {
    if (!this._wallet) {
      console.warn('no wallet implementation found')
      throw D.error.deviceNotInit
    }
    return this._wallet.getWalletInfo()
  }

  async getAddress (coinType, path, isShowing = false, isStoring = false) {
    if (!this._wallet) {
      console.warn('no wallet implementation found')
      throw D.error.deviceNotInit
    }
    return this._wallet.getAddress(coinType, path, isShowing, isStoring)
  }

  async signTransaction (coinType, tx) {
    if (!this._wallet) {
      console.warn('no wallet implementation found')
      throw D.error.deviceNotInit
    }
    return this._wallet.signTransaction(coinType, tx)
  }

  _sendApdu (apdu, isEnc = false) {
    if (!this._wallet) {
      console.warn('no wallet implementation found')
      throw D.error.deviceNotInit
    }
    return this._wallet._sendApdu(apdu, isEnc)
  }
}
