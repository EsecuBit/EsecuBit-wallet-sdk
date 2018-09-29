import D from './D'
import IndexedDB from './data/database/IndexedDB'
import JSWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import HidTransmitter from './device/transmit/HidTransmitter'
import _MockTransmitter from './device/transmit/MockTransmitter'
import ChromeHidDevice from './device/transmit/io/ChromeHidDevice'
import _MockDevice from './device/transmit/io/MockDevice'

const Provider = {
  getDB () { return this.DB },
  getWallet () { return D.test.jsWallet ? this.SoftWallet : this.HardWallet },
  getTransmitter () { return D.test.mockTransmitter ? this.MockTransmitter : this.HardTransmitter },
  getDevice () { return D.test.mockDevice ? this.MockDevice : this.HardDevice },

  DB: IndexedDB,
  SoftWallet: JSWallet,
  HardWallet: CoreWallet,
  MockTransmitter: _MockTransmitter,
  HardTransmitter: HidTransmitter,
  MockDevice: _MockDevice,
  HardDevice: ChromeHidDevice
}
export default Provider
