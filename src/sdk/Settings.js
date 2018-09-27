import Provider from './Provider'
import JsWallet from './device/JsWallet'

/**
 * Settings for Application.
 */
export default class Settings {
  constructor () {
    if (JsWallet.prototype.Instance) {
      return JsWallet.prototype.Instance
    }
    JsWallet.prototype.Instance = this
  }

  async _init () {
    this._settingDb = new Provider.DB('settings')
    await this._settingDb.init()
  }

  async getSetting (key) {
    if (!this._settingDb) {
      await this._init()
    }
    return this._settingDb.getSettings(key)
  }

  async setSetting (key, value) {
    if (!this._settingDb) {
      await this._init()
    }
    return this._settingDb.saveOrUpdateSettings(key, value)
  }
}
