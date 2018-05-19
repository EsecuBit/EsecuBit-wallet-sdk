
const Wallet = require('../sdk/EsWallet').class
const D = require('../sdk/D').class

const deviceId = 'default'
const passPhraseId = 'BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548'
const coinType = D.COIN_BIT_COIN
const wallet = new Wallet()

// TODO test
wallet.listenDevice(function (error, isPlugIn) {
  console.log('listenDevice: error ' + error + ', isPlugIn ' + isPlugIn)

  if (!isPlugIn) {
    console.log('plug out')
    return
  }

  console.log('device plug in')

  wallet.getWalletInfo(function (error, info) {
    console.log('getWalletInfo: error ' + error)
    console.dir(info)
  })

  wallet.getAccounts(deviceId, passPhraseId, function (error, accounts) {
    console.log('getAccounts: error: ' + error)
    console.dir(accounts)
    if (error !== D.ERROR_NO_ERROR) {
      return
    }

    const account = accounts[0]
    account.getAddress({}, function (error, address) {
      console.log('getAddress: error ' + error)
      console.dir(address)

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getAddress({force: true}, function (error, address) {
        console.log('getNewAddress: error ' + error)
        console.dir(address)
      })

      account.getTxInfos(0, 10, function (error, total, transactions) {
        console.log('getTxInfo: error ' + error)
        console.dir(total)
        console.dir(transactions)
      })
    })

    wallet.newAccount(deviceId, passPhraseId, coinType, function (error, account) {
      console.log('newAccount: error: ' + error)
      console.dir(account)
      if (error !== D.ERROR_NO_ERROR) {
        return
      }
      wallet.getAccounts(deviceId, passPhraseId, function (error, accounts) {
        console.log('getAccounts2: error: ' + error)
        console.dir(accounts)
      })
    })
  })
})
