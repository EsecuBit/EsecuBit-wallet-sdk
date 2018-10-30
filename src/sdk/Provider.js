import IndexedDB from './data/database/IndexedDB'

import JSWallet from './device/implements/JsWallet'
import NetBankWallet from './device/implements/NetBankWallet'
import S300Wallet from './device/implements/S300Wallet'

import JsTransmitter from './device/implements/transmit/JsTransmitter'
import MockTransmitter from './device/implements/transmit/MockTransmitter'
import HidTransmitter from './device/implements/transmit/HidTransmitter'
import CcidTransmitter from './device/implements/transmit/CcidTransmitter'

const Provider = {
  Transmitters: [
    JsTransmitter,
    MockTransmitter,
    CcidTransmitter,
    HidTransmitter
  ],

  Wallets: [
    JSWallet,
    S300Wallet,
    NetBankWallet
  ],

  DB: IndexedDB
}

export default Provider
