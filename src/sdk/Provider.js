import IndexedDB from './data/database/IndexedDB'

import JSWallet from './device/implements/JsWallet'
import NetBankWallet from './device/implements/NetBankWallet'
import S300Wallet from './device/implements/S300Wallet'

import JsTransmitter from './device/implements/transmitter/JsTransmitter'
import MockTransmitter from './device/implements/transmitter/MockTransmitter'
import HidTransmitter from './device/implements/transmitter/HidTransmitter'
import CcidTransmitter from './device/implements/transmitter/CcidTransmitter'
import Crypto from './device/implements/protocol/Crypto'

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

  DB: IndexedDB,

  Crypto: Crypto
}

export default Provider
