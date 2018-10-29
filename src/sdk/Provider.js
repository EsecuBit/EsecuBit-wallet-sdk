import D from './D'
import IndexedDB from './data/database/IndexedDB'
import JSWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'

import HidTransmitter from './device/transmit/HidTransmitter'
import _MockTransmitter from './device/transmit/MockTransmitter'
import ChromeHidDevice from './device/transmit/io/ChromeHidDevice'
import _MockDevice from './device/transmit/io/MockDevice'

import ChromeUsbDevice from './device/transmit/io/ChromeUsbDevice'
import CcidTransmitter from './device/transmit/CcidTransmitter'

const Provider = {
  getDB () { return this.DB },
  getWallet () { return D.test.jsWallet ? this.SoftWallet : this.HardWallet },
  getTransmitter () { return D.test.mockTransmitter ? this.MockTransmitter : this.HardTransmitter },
  getCcidTransmitter () { return D.test.mockTransmitter ? this.MockTransmitter : this.CcidTransmitter },

  getDevice () { return D.test.mockDevice ? this.MockDevice : this.HardDevice },
  getUsbDevice () { return D.test.mockDevice ? this.MockDevice : this.UsbDevice },

  DB: IndexedDB,
  SoftWallet: JSWallet,
  HardWallet: CoreWallet,

  MockTransmitter: _MockTransmitter,
  HardTransmitter: HidTransmitter,
  CcidTransmitter: CcidTransmitter,

  MockDevice: _MockDevice,
  HardDevice: ChromeHidDevice,
  UsbDevice: ChromeUsbDevice
}
export default Provider
