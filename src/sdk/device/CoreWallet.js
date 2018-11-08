import Provider from '../Provider'
import D from '../D'

export default class CoreWallet {
  constructor () {
    this._transmitter = null
    this._wallet = null
    this._externlistener = () => {}
  }

  listenPlug (listener) {
    this._externlistener = listener || this._externlistener

    if (this._transmitter) {
      D.dispatch(() => this._externlistener(D.error.succeed, D.status.plugIn))
      return
    }

    for (let Transmitter of Provider.Transmitters) {
      let transmitter = new Transmitter()
      let plugInListener = (error, status) => {
        if (!this._transmitter && status == D.status.plugOut) {
          console.debug('other transmitter plug out, ignore', transmitter)
          return
        }
        if (this._transmitter && status == D.status.plugIn) {
          console.debug('already a transmitter pluged in, ignore', transmitter)
          return
        }
        console.info('transmitter pluged event', transmitter, error, status)

        if (error !== D.error.succeed) {
          D.dispatch(() => this._externlistener(error, status))
          return
        }

        if (status === D.status.plugIn) {
          this._transmitter = transmitter
        } else if (status === D.status.plugOut) {
          this._transmitter = null
        } else {
          console.warn('unknown status', error, status)
        }
        D.dispatch(() => this._externlistener(error, status))
      }
      console.debug('listenPlug', transmitter)
      transmitter.listenPlug(plugInListener)
    }
  }

  async init () {
    if (!this._transmitter) {
      console.warn('device not connected')
      throw D.error.deviceNotInit
    }

    for (let Wallet of Provider.Wallets) {
      let wallet = new Wallet(this._transmitter)
      try {
        let walletInfo = await wallet.init()
        this._wallet = wallet
        return walletInfo
      } catch (e) {
        // continue
      }
    }
    console.warn('no suitable wallet found', this._transmitter, Provider.Wallets)
    throw D.error.deviceProtocol
  }

  async verifyPin () {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet.verifyPin()
  }

  getWalletInfo () {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet.getWalletInfo()
  }

  getAddress (coinType, path, isShowing = false, isStoring = false) {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet.getAddress(coinType, path, isShowing, isStoring)
  }

  getPublicKey (coinType, keyPath) {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet.getPublicKey(coinType, keyPath)
  }

  async signTransaction (coinType, tx) {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet.signTransaction(coinType, tx)
  }

  _sendApdu (apdu, isEnc = false) {
    if (!this._wallet) {
      console.warn('init wallet first')
      throw D.error.deviceNotInit
    }
    return this._wallet._sendApdu(apdu, isEnc)
  }
}
