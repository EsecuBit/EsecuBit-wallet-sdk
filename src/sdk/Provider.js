import IndexedDB from './data/database/IndexedDB'

import JSWallet from './device/implements/JsWallet'
import NetBankWallet from './device/implements/NetBankWallet'
import S300Wallet from './device/implements/S300Wallet'

import JsTransmitter from './device/implements/transmitter/JsTransmitter'
import MockTransmitter from './device/implements/transmitter/MockTransmitter'
import NetBankTransmitter from './device/implements/transmitter/NetBankTransmitter'
import S300Transmitter from './device/implements/transmitter/S300Transmitter'

const Provider = {
  Transmitters: [
    JsTransmitter,
    MockTransmitter,
    S300Transmitter,
    NetBankTransmitter
  ],

  Wallets: [
    JSWallet,
    S300Wallet,
    NetBankWallet
  ],

  DB: IndexedDB
}

export default Provider
