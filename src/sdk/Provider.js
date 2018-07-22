import IndexedDB from './data/database/IndexedDB'
import JSWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'

const Provider = {
  DB: IndexedDB,
  SoftWallet: JSWallet,
  HardWallet: CoreWallet
}
export default Provider
