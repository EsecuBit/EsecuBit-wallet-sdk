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

  HardWallet: CoreWallet,
  SoftWallet: JSWallet,
  Wallet: D.test.jsWallet ? this.SoftWallet : this.HardWallet,

  HardTransmitter: HidTransmitter,
  MockTransmitter: MockTransmitter,
  Transmitter: D.test.mockTransmitter ? this.MockTransmitter : this.HardTransmitter,

  HardDevice: ChromeHidDevice,
  MockDevice: MockDevice,
  Device: D.test.mockDevice ? this.MockDevice : this.HardDevice
}
export default Provider
