import Provider from '../Provider'
import D from '../D'

export default class CoreWallet {
  constructor () {
    this._transmitter = null
    this._wallet = null
    this._externListener = () => {}
  }

  _listenPlug () {
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
          D.dispatch(() => this._externListener(error, status))
          return
        }

        if (status === D.status.plugIn) {
          this._transmitter = transmitter
        } else if (status === D.status.plugOut) {
          this._transmitter = null
          this._wallet = null
        } else {
          console.warn('unknown status', error, status)
        }
        D.dispatch(() => this._externListener(error, status))
      }
      console.debug('listenPlug', transmitter.constructor.name)
      transmitter.listenPlug(plugInListener)
    }
  }

  listenPlug (listener) {
    this._externListener = listener || (() => {})

    if (this._transmitter) {
      D.dispatch(() => this._externListener(D.error.succeed, D.status.plugIn))
    }
    this._listenPlug()
  }

  async init (authCallback) {
    if (!this._transmitter) {
      console.warn('device not connected')
      throw D.error.deviceNotConnected
    }
    if (this._wallet) {
      console.info('CoreWallet has inited, return')
      return D.copy(this._walletInfo)
    }

    let messages = []
    for (let Wallet of Provider.Wallets) {
      let wallet = new Wallet(this._transmitter)
      try {
        this._walletInfo = await wallet.init(authCallback)
        this._wallet = wallet
        return D.copy(this._walletInfo)
      } catch (e) {
        messages.push({wallet: wallet.constructor.name, error: e})
        // continue
      }
    }
    console.warn('no suitable wallet found, maybe wallet get error in init()', this._transmitter, messages)
    throw D.error.deviceProtocol
  }

  async verifyPin () {
    if (!this._wallet) {
      console.warn('before verifyPin, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.verifyPin()
  }

  getCosVersion() {
    if (!this._wallet) {
      console.warn('before getCosVersion, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getCosVersion()
  }

  getWalletInfo () {
    if (!this._wallet) {
      console.warn('before getWalletInfo, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getWalletInfo()
  }

  getAddress (coinType, path, isShowing = false, isStoring = false) {
    if (!this._wallet) {
      console.warn('before getAddress, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getAddress(coinType, path, isShowing, isStoring)
  }

  getAddresses (coinType, publicKey, chainNode, type, fromIndex, toIndex) {
    if (!this._wallet) {
      console.warn('before getAddresses, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getAddresses(coinType, publicKey, chainNode, type, fromIndex, toIndex)
  }

  getAccountName (coinType, accountIndex, pmData, isShowing = false, isStoring = false) {
    if (!this._wallet) {
      console.warn('before getAccountName, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getAccountName(coinType, accountIndex, pmData, isShowing, isStoring)
  }

  getPublicKey (coinType, keyPath) {
    if (!this._wallet) {
      console.warn('before getPublicKey, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getPublicKey(coinType, keyPath)
  }

  async signTransaction (coinType, tx) {
    if (!this._wallet) {
      console.warn('before signTransaction, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.signTransaction(coinType, tx)
  }

  async getWalletBattery () {
    if (!this._wallet) {
      console.warn('before getWalletBattery, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getWalletBattery()
  }

  async getWalletId() {
    if (!this._wallet) {
      console.warn('before getWalletId, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getWalletId()
  }


  async getDefaultPermissions (coinType, accountIndex) {
    if (!this._wallet) {
      console.warn('before getDefaultPermissions, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getDefaultPermissions(coinType, accountIndex)
  }

  async addPermission (coinType, pmInfo) {
    if (!this._wallet) {
      console.warn('before addPermission, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.addPermission(coinType, pmInfo)
  }

  async removePermission (coinType, pmInfo) {
    if (!this._wallet) {
      console.warn('before removePermission, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.removePermission(coinType, pmInfo)
  }

  async getPermissions (coinType, accountIndex) {
    if (!this._wallet) {
      console.warn('before getPermissions, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getPermissions(coinType, accountIndex)
  }

  async importKey (coinType, keyInfo) {
    if (!this._wallet) {
      console.warn('before importKey, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.importKey(coinType, keyInfo)
  }

  async removeKey (coinType, keyInfo) {
    if (!this._wallet) {
      console.warn('before removeKey, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.removeKey(coinType, keyInfo)
  }

  async addToken (coinType, token) {
    if (!this._wallet) {
      console.warn('before addToken, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.addToken(coinType, token)
  }

  async removeToken (coinType, token) {
    if (!this._wallet) {
      console.warn('before removeToken, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.removeToken(coinType, token)
  }

  async setAmountLimit (coinType, amountLimit) {
    if (!this._wallet) {
      console.warn('before setAmountLimit, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.setAmountLimit(coinType, amountLimit)
  }

  async getDeriveData (coinType, path) {
    if (!this._wallet) {
      console.warn('before getDeriveData, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.getDeriveData(coinType, path)
  }

  sendApdu (apdu, isEnc = false, coinType) {
    if (!this._wallet) {
      console.warn('before sendApdu, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.sendApdu(apdu, isEnc, coinType)
  }

  reset () {
    if (!this._wallet) {
      console.warn('before reset wallet, init wallet first')
      throw D.error.deviceNotConnected
    }
    return this._wallet.reset()
  }

  getWalletName () {
    throw D.error.notImplemented
  }
}
