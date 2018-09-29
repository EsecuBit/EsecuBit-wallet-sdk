import Provider from './Provider'

/**
 * Settings for Application.
 */
export default class Settings {
  constructor () {
    if (Settings.prototype.Instance) {
      return Settings.prototype.Instance
    }
    Settings.prototype.Instance = this
  }

  async _init () {
    const DB = Provider.getDB()
    let db = new DB('default')
    await db.init()
    this._settingDb = db
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
    await this._settingDb.saveOrUpdateSettings(key, value)
  }
}
