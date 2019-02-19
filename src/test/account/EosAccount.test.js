
import chai from 'chai'
import JsWallet from '../../sdk/device/implements/JsWallet'
import EosAccount from '../../sdk/account/EosAccount'
import CoinData from '../../sdk/data/CoinData'
import D from '../../sdk/D'
import JsTransmitter from '../../sdk/device/implements/transmitter/JsTransmitter'
import Settings from '../../sdk/Settings'
import S300Wallet from '../../sdk/device/implements/S300Wallet'
import CcidTransmitter from '../../sdk/device/implements/transmitter/CcidTransmitter'

chai.should()

D.test.jsWallet = true
D.test.coin = true

describe('EosAccount sync and sign', function () {
  this.timeout(60 * 1000)
  let account
  let coinData
  let oldSupported

  before(async function () {
    oldSupported = D.supportedCoinTypes
    let coinType = D.test.coin ? D.coin.test.eosJungle : D.coin.main.eos
    D.supportedCoinTypes = () => [coinType]

    let transmitter
    let wallet
    if (D.test.jsWallet) {
      // write your own seed
      await new Settings().setTestSeed('00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')
      transmitter = new JsTransmitter()
      wallet = new JsWallet(transmitter)
    } else {
      transmitter = new CcidTransmitter()
      wallet = new S300Wallet(transmitter)
    }
    transmitter.listenPlug(async (error, status) => {
      if (error !== D.error.succeed) {
        throw error
      }
      if (status === D.status.plugIn) {
        coinData = new CoinData()
        let walletInfo = await wallet.init()
        await coinData.init(walletInfo)
        // await coinData.clearData()

        account = new EosAccount({
          label: 'esecubit1111',
          coinType: coinType,
          accountId: coinType + '_0_23f876c8a',
          index: 0,
          balance: '0',
          externalPublicKeyIndex: 0,
          changePublicKeyIndex: 0
        }, wallet, coinData)
        await account.init()
        try {
          await account.sync((error, status, pms) => {
            console.warn('sync', error, status, pms)
          })
          // await account.checkNewPermission((error, status, pms) => {
          //   console.warn('checkNewPermission', error, status, pms)
          // })
        } catch (e) {
          console.warn(e)
        }
        this.finish = true
      }
    })

    while (!this.finish) {
      await D.wait(10)
    }
  })

  after(async function () {
    D.supportedCoinTypes = oldSupported
    // await coinData.clearData()
    // await coinData.release()
  })

  it('signTx', async function () {
    let details = {
      type: 'tokenTransfer',
      token: 'EOS',
      outputs: [{
        account: 'inita',
        value: '70'
      }, {
        account: 'initb',
        value: '6.6'
      }]
    }
    let prepareTx = await account.prepareTx(details)
    console.log('prepareTx', prepareTx, JSON.stringify(prepareTx, null, 2))
    let buildTx = await account.buildTx(prepareTx)
    console.log('EosAccount buildTx', buildTx, JSON.stringify(buildTx, null, 2))
    buildTx.should.not.equal(undefined)
  })

  it('signTx2', async function () {
    let details = {
      type: 'tokenTransfer',
      token: 'EOS',
      outputs: [{
        account: 'sickworm1111',
        value: '0.213'
      }]
    }
    let prepareTx = await account.prepareTx(details)
    console.log('prepareTx 2', prepareTx, JSON.stringify(prepareTx, null, 2))
    let signedTx = await account.buildTx(prepareTx)
    console.log('EosAccount buildTx 2', signedTx, JSON.stringify(signedTx, null, 2))
    signedTx.should.not.equal(undefined)
    // await account.sendTx(signedTx)
  })
})
