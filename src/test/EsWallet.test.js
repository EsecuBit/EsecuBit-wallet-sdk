
import chai from 'chai'
import D from '../sdk/D'
import EsWallet from '../sdk/EsWallet'
import IndexedDB from '../sdk/data/database/IndexedDB'

chai.should()
describe('EsWallet', function () {
  this.timeout(200000)
  let esWallet = null

  // it('clearDatabase', async () => {
  //   let indexedDB = new IndexedDB(D.test.syncWalletId)
  //   await indexedDB.init()
  //   await indexedDB.clearDatabase()
  // })

  // new EsWallet may trigger sync, so make it lazy
  it('init', async () => {
    D.test.coin = true
    D.test.sync = true
    D.test.networkRequest = true
    D.test.jsWallet = true
    esWallet = new EsWallet()
  })

  it('supportedCoinTypes', () => {
    let supportedCoinTypes = EsWallet.supportedCoinTypes()
    supportedCoinTypes.should.deep.equal([D.coin.test.btcTestNet3, D.coin.test.ethRinkeby])
  })

  it('suppertedLegals', () => {
    let supportedLegalCurrency = EsWallet.suppertedLegals()
    supportedLegalCurrency.should.deep.equal([D.unit.legal.USD, D.unit.legal.EUR, D.unit.legal.CNY, D.unit.legal.JPY])
  })

  it('listenStatus', (done) => {
    const statusList = [D.status.plugIn, D.status.initializing, D.status.syncing, D.status.syncFinish]
    let currentStatusIndex = 0

    esWallet.listenTxInfo((error, txInfo) => {
      console.log('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.log('error, status', error, status)
      if (error !== D.error.succeed) {
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
    accounts.length.should.equal(3)
  })

  let availableNewAccountCoinType
  it('availableNewAccountCoinTypes', async () => {
    let availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    console.log('availableNewAccountCoinTypes', availableNewAccountCoinTypes)
    availableNewAccountCoinTypes.length.should.equal(2)
    availableNewAccountCoinType = availableNewAccountCoinTypes.find(coinType => D.isBtc(coinType))
    availableNewAccountCoinType.should.not.equal(undefined)
  })

  it('newAccountAndDelete', async () => {
    let account = await esWallet.newAccount(availableNewAccountCoinType)
    let availableNewAccountCoinTypes = await esWallet.availableNewAccountCoinTypes()
    availableNewAccountCoinTypes.length.should.equal(1)
    await account.delete()
  })

  it('getWalletInfo', async () => {
    let info = await esWallet.getWalletInfo()
    console.log('wallet info', info)
    info.should.not.equal(undefined)
  })

  it('getProviders', async () => {
    let providers = await esWallet.getProviders()
    console.log('providers', providers)
  })

  it('convertValue', () => {
    D.suppertedCoinTypes().forEach(coinType => {
      if (D.isBtc(coinType)) {
        esWallet.convertValue(coinType, '123456', D.unit.btc.satoshi, D.unit.btc.BTC).should.equal('0.00123456')
        esWallet.convertValue(coinType, '123456', D.unit.btc.satoshi, D.unit.btc.mBTC).should.equal('1.23456')
        esWallet.convertValue(coinType, '123456', D.unit.btc.BTC, D.unit.btc.satoshi).should.equal('12345600000000')
        esWallet.convertValue(coinType, '123456', D.unit.btc.mBTC, D.unit.btc.satoshi).should.equal('12345600000')
        esWallet.convertValue(coinType, '123456', D.unit.btc.satoshi, D.unit.btc.satoshi).should.equal('123456')
        esWallet.convertValue(coinType, '123456', D.unit.btc.BTC, D.unit.legal.USD)
        esWallet.convertValue(coinType, '123456', D.unit.btc.mBTC, D.unit.legal.CNY)
        esWallet.convertValue(coinType, '123456', D.unit.btc.satoshi, D.unit.legal.EUR)
        esWallet.convertValue(coinType, '123456', D.unit.legal.USD, D.unit.btc.BTC)
        esWallet.convertValue(coinType, '123456', D.unit.legal.CNY, D.unit.btc.mBTC)
        esWallet.convertValue(coinType, '123456', D.unit.legal.EUR, D.unit.btc.satoshi)
      }
      if (D.isEth(coinType)) {
        esWallet.convertValue(coinType, '123456', D.unit.eth.Ether, D.unit.eth.Wei).should.equal('123456000000000000000000')
        esWallet.convertValue(coinType, '123456', D.unit.eth.GWei, D.unit.eth.Wei).should.equal('123456000000000')
        esWallet.convertValue(coinType, '123456', D.unit.eth.Wei, D.unit.eth.Ether).should.equal('0.000000000000123456')
        esWallet.convertValue(coinType, '123456', D.unit.eth.Wei, D.unit.eth.GWei).should.equal('0.000123456')
        esWallet.convertValue(coinType, '123456', D.unit.eth.Wei, D.unit.eth.Wei).should.equal('123456')
        esWallet.convertValue(coinType, '123456', D.unit.eth.GWei, D.unit.legal.CNY)
        esWallet.convertValue(coinType, '123456', D.unit.eth.Wei, D.unit.legal.JPY)
        esWallet.convertValue(coinType, '123456', D.unit.legal.USD, D.unit.eth.Ether)
        esWallet.convertValue(coinType, '123456', D.unit.legal.CNY, D.unit.eth.GWei)
        esWallet.convertValue(coinType, '123456', D.unit.legal.JPY, D.unit.eth.Wei)
      }
    })
  })

  // it('reset', () => {
  //   esWallet.reset()
  // })
})
