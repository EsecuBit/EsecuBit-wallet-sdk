
import chai from 'chai'
import D from '../sdk/D'
import EsWallet from '../sdk/EsWallet'

chai.should()
describe('EsWallet', function () {
  this.timeout(60000)
  let esWallet = null

  it('availableCoinTypes', () => {
    let availableCoinTypes = EsWallet.availableCoinTypes()
    availableCoinTypes.length.should.equal(1)
  })

  it('convertValue', () => {
    let coinTypes = [D.COIN_BIT_COIN, D.COIN_BIT_COIN_TEST]
    coinTypes.forEach(coinType => {
      EsWallet.convertValue(coinType, 123456, D.UNIT_BTC_SANTOSHI, D.UNIT_BTC).should.equal(0.00123456)
      EsWallet.convertValue(coinType, 123456, D.UNIT_BTC_SANTOSHI, D.UNIT_BTC_M).should.equal(1.23456)
      EsWallet.convertValue(coinType, 123456, D.UNIT_BTC, D.UNIT_BTC_SANTOSHI).should.equal(12345600000000)
      EsWallet.convertValue(coinType, 123456, D.UNIT_BTC_M, D.UNIT_BTC_SANTOSHI).should.equal(12345600000)
    })
  })

  // it('clearDatabase', async () => {
  //   let indexedDB = new IndexedDB(D.TEST_SYNC_WALLET_ID)
  //   await indexedDB.init()
  //   await indexedDB.clearDatabase()
  // })

  // new EsWallet will have heavy work, so do the lazy work
  it('new wallet', async () => {
    D.TEST_SYNC = true
    esWallet = new EsWallet()
  })

  it('listenStatus', (done) => {
    const statusList = [D.STATUS_PLUG_IN, D.STATUS_INITIALIZING, D.STATUS_SYNCING, D.STATUS_SYNC_FINISH]
    let currentStatusIndex = 0

    esWallet.listenTxInfo((error, txInfo) => {
      console.info('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.info('error, status', error, status)
      if (error !== D.ERROR_NO_ERROR) {
        done(error)
        return
      }
      if (status !== statusList[currentStatusIndex]) {
        done(status !== statusList[currentStatusIndex])
        return
      }
      currentStatusIndex++
      if (currentStatusIndex === statusList.length) {
        done()
      }
    })
  })

  it('getAccounts', async () => {
    let accounts = await esWallet.getAccounts()
    accounts.length.should.equal(2)
  })

  let availableNewAccountCoinTypes
  it('availableNewAccountCoinTypes', async () => {
    availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    availableNewAccountCoinTypes.length.should.equal(1)
  })

  it('newAccountAndDelete', async () => {
    let account = await esWallet.newAccount(availableNewAccountCoinTypes[0])
    availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    availableNewAccountCoinTypes.length.should.equal(0)
    await account.delete()
  })

  it('getWalletInfo', async () => {
    let info = esWallet.getWalletInfo()
    info.should.not.equal(undefined)
  })
})
