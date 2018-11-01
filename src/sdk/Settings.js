import Provider from './Provider'
import D from "esecubit-wallet-sdk/src/sdk/D";

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
    let db = new Provider.DB('default')
    await db.init()
    this._settingDb = db
  }

  async getSetting (key, namespace = undefined) {
    if (!this._settingDb) {
      await this._init()
    }
    if (namespace) key = key + '_' + namespace
    let value = await this._settingDb.getSettings(key)
    return (value && JSON.parse(value)) || undefined
  }

  async setSetting (key, value, namespace = undefined) {
    if (!this._settingDb) {
      await this._init()
    }
    if (namespace) key = key + '_' + namespace
    await this._settingDb.saveOrUpdateSettings(key, JSON.stringify(value))
  }

  async getTestSeed () {
    let testSeed = await new Settings().getSetting('testSeed')
    if (!testSeed) {
      testSeed = D.test.generateSeed()
      await this.setTestSeed(testSeed)
    }
    return testSeed
  }

  async setTestSeed (testSeed) {
    await new Settings().setSetting('testSeed', testSeed)
  }
}
