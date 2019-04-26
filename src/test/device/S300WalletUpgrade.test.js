
import D from '../../sdk/D'
import Provider from '../../sdk/Provider'
import S300Wallet from '../../sdk/device/implements/S300Wallet'
import ChromeUsbDevice from '../../sdk/device/implements/transmitter/io/ChromeUsbDevice'
import chai from 'chai'
import CcidTransmitter from '../../sdk/device/implements/transmitter/CcidTransmitter'
import UpgradeManager from '../../sdk/device/update/UpgradeManager'

Provider.HardDevice = ChromeUsbDevice

chai.should()
describe('S300Wallet', function () {
  let s300Wallet
  this.timeout(600000)

  before(function (done) {
    let transmitter = new CcidTransmitter()
    transmitter.listenPlug((error, status) => {
      error.should.equal(D.error.succeed)
      if (status === D.status.plugIn) {
        s300Wallet = new S300Wallet(transmitter)
        s300Wallet.init().then(() => {
          s300Wallet._allEnc = false
          done()
        })
      }
    })
  })

  it('get btc version', async () => {
    let version = await s300Wallet.sendApdu('804A000000', true, D.coin.main.btc)
    console.log('version', version.toString('hex'))
  })

  it('update btc applet', async () => {
    let upgradeManager = new UpgradeManager(s300Wallet)
    let appletList = await upgradeManager.getAppletList()
    console.log('appletList', appletList)

    let btcInfo = appletList.find(a => a.name === 'BTC')
    if (btcInfo.installed && !btcInfo.upgradable) {
      console.log('no need to update btc')
      return
    }

    await upgradeManager.installUpdate(btcInfo)
  })

  it('get btc version again', async () => {
    let version = await s300Wallet.sendApdu('804A000000', true, D.coin.main.btc)
    console.log('new version', version.toString('hex'))
  })
})
