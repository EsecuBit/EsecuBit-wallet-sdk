
import chai from 'chai'
import D from '../sdk/D'
import EsWallet from '../sdk/EsWallet'
import IndexedDB from '../sdk/data/database/IndexedDB'

chai.should()
describe('EsWallet', function () {
  this.timeout(100000)
  let esWallet = null

  it('availableCoinTypes', () => {
    let availableCoinTypes = EsWallet.availableCoinTypes()
    availableCoinTypes.length.should.equal(2)
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
        console.warn('found error', error)
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

  let availableNewAccountCoinType
  it('availableNewAccountCoinTypes', async () => {
    let availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    availableNewAccountCoinTypes.length.should.equal(2)
    availableNewAccountCoinType = availableNewAccountCoinTypes.find(coinType => coinType.includes('bitcoin'))
  })

  it('newAccountAndDelete', async () => {
    let account = await esWallet.newAccount(availableNewAccountCoinType)
    let availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    availableNewAccountCoinTypes.length.should.equal(1)
    await account.delete()
  })

  it('getWalletInfo', async () => {
    let info = esWallet.getWalletInfo()
    info.should.not.equal(undefined)
  })

  it('convertValue', () => {
    let coinTypes = D.TEST_MODE ? D.SUPPORT_TEST_COIN_TYPES : D.SUPPORT_COIN_TYPES
    coinTypes.forEach(coinType => {
      if (coinType.includes('bitcoin')) {
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC_SANTOSHI, D.UNIT_BTC).should.equal(0.00123456)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC_SANTOSHI, D.UNIT_BTC_M).should.equal(1.23456)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC, D.UNIT_BTC_SANTOSHI).should.equal(12345600000000)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC_M, D.UNIT_BTC_SANTOSHI).should.equal(12345600000)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC, D.UNIT_USD)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC_M, D.UNIT_CNY)
        esWallet.convertValue(coinType, 123456, D.UNIT_BTC_SANTOSHI, D.UNIT_EUR)
        esWallet.convertValue(coinType, 123456, D.UNIT_USD, D.UNIT_BTC)
        esWallet.convertValue(coinType, 123456, D.UNIT_CNY, D.UNIT_BTC_M)
        esWallet.convertValue(coinType, 123456, D.UNIT_EUR, D.UNIT_BTC_SANTOSHI)
      }
      if (coinType.includes('ethernet')) {
        esWallet.convertValue(coinType, 123456, D.UNIT_ETH, D.UNIT_USD)
        esWallet.convertValue(coinType, 123456, D.UNIT_ETH_GWEI, D.UNIT_CNY)
        esWallet.convertValue(coinType, 123456, D.UNIT_ETH_WEI, D.UNIT_JPY)
        esWallet.convertValue(coinType, 123456, D.UNIT_USD, D.UNIT_ETH)
        esWallet.convertValue(coinType, 123456, D.UNIT_CNY, D.UNIT_ETH_GWEI)
        esWallet.convertValue(coinType, 123456, D.UNIT_JPY, D.UNIT_ETH_WEI)
      }
    })
  })
})
