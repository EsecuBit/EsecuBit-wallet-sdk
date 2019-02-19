import Provider from '../Provider'
import D from '../D'

export default class CoreWallet {
  constructor () {
    this._transmitter = null
    this._wallet = null
    this._externlistener = () => {}

    return new Proxy(this, {
      get: function (target, key, receiver) {
        if (typeof target[key] === 'function' &&
          !key.startsWith('_') &&
          key !== 'listenPlug' &&
          key !== 'init' &&
          !target._wallet) {
          console.warn('init wallet first')
          throw D.error.deviceNotConnected
        }
        if (target._wallet &&
          (typeof target._wallet[key] === 'function')) {
          return function () {
            console.debug('proxy CoreWallet function to wallet implement', key, arguments.length)
            return target._wallet[key].apply(target._wallet, arguments)
          }
        }
        return Reflect.get(target, key, receiver)
      }
    })
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
        if (!this._transmitter && status === D.status.plugOut) {
          console.debug('other transmitter plug out, ignore', transmitter)
          return
        }
        if (this._transmitter && status === D.status.plugIn) {
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
      console.debug('listenPlug', transmitter.constructor.name)
      transmitter.listenPlug(plugInListener)
    }
  }

  async init (authCallback) {
    if (!this._transmitter) {
      console.warn('device not connected')
      throw D.error.deviceNotConnected
    }

    let messages = []
    for (let Wallet of Provider.Wallets) {
      let wallet = new Wallet(this._transmitter)
      try {
        let walletInfo = await wallet.init(authCallback)
        this._wallet = wallet
        return walletInfo
      } catch (e) {
        messages.push({wallet: wallet.constructor.name, error: e})
        // continue
      }
    }
    console.warn('no suitable wallet found, maybe wallet get error in init()', this._transmitter, messages)
    throw D.error.deviceProtocol
  }
}
