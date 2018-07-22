import IndexedDB from './data/database/IndexedDB'
import JSWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import HidTransmitter from './device/HidTransmitter'

const Provider = {
  DB: IndexedDB,
  SoftWallet: JSWallet,
  HardWallet: CoreWallet,
  Transmitter: HidTransmitter
}
export default Provider
