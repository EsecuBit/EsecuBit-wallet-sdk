import D from './D'
import IndexedDB from './data/database/IndexedDB'
import JSWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import HidTransmitter from './device/transmit/HidTransmitter'
import MockTransmitter from './device/transmit/MockTransmitter'
import ChromeHidDevice from './device/transmit/io/ChromeHidDevice'
import MockDevice from './device/transmit/io/MockDevice'

const Provider = {
  DB: IndexedDB,

  Wallet: D.test.jsWallet ? JSWallet : CoreWallet,
  Transmitter: D.test.mockTransmitter ? MockTransmitter : HidTransmitter,
  Device: D.test.mockDevice ? MockDevice : ChromeHidDevice
}
export default Provider
