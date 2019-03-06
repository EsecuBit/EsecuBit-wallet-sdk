# EsecuBit-wallet-sdk

## Introduction

EsecuBit Wallet SDK is a JavaScript SDK for EsecuBit
digital currency wallet. Supporting Apps: [EsecuBit React Native Wallet (Android, iOS)](https://github.com/EsecuBit/EsecuBit-react-native-wallet), [EsecuBit Chrome Wallet](https://github.com/EsecuBit/EsecuBit-chrome-wallet).

EsecuBit Wallet SDK supports both hardware wallet ([EsecuBit hardware wallet](http://www.esecubit.com/)) and software wallet (default software wallet). **But the security of software wallet is not guaranteed, the seed is stored in plain text in database**. It's just for test usage.

EsecuBit Wallet SDK supports mainnet and testnet (default testnet).

EsecuBit Wallet SDK using ES6/7 features.

## Supported Digital Currencies

* Bitcoin (BTC)
* Ethereum (ETH)
* EOS (EOS)

**COMING SOON**

* Bitcoin Cash (BCH)
* Litecoin (LTC)
* Dash (DASH)
* ZCash (ZEC)
* Ripple (XRP)

## Blockchain Browser API Provider

BTC:
* [blockchain.com](https://www.blockchain.com/) (default)
* [chain.so](https://chain.so/) (not fully tested)

ETH:
* [etherscan.io](https://etherscan.io/)

EOS:
* [geo.eosasia.one](https://geo.eosasia.one/) (default)
* [eos.greymass.com](https://eos.greymass.com/)
* [public.eosinfra.io](https://public.eosinfra.io/)
* 

## Other API Provider

BTC Fee:
* [bitcoinfees.earn.com](https://bitcoinfees.earn.com/)

ETH Fee:
* [ethgasstation.info](https://ethgasstation.info/)

Digital Currency Exchange:
* [cryptocompare.com](https://cryptocompare.com/)

## Import SDK

```shell
npm install esecuBit-wallet-sdk // latest released version
// or
npm install git+ssh://github.com/EsecuBit/EsecuBit-wallet-sdk.git // newest version on GitHub

// if you are runing on a low version of Chrome (<= 54), you may need to use the compiled version
// add it in the webpack.config:
resolve: {
  alias: {
    "esecubit-wallet-sdk": "esecubit-wallet-sdk/dist/eswallet"
  }
}
```

## Usage

1. SDK Configuration

Configuration should do before `new EsWallet()`.

```javascript
import {D} from 'esecubit-wallet-sdk'

// configure it before call EsWallet
D.test.jsWallet = true // use javascript wallet, default false (hardware wallet)
D.test.coin = true // use testnet, dafault false (mainnet)

// configure supported coins, default supports BTC, ETH, EOS
D.supportedCoinTypes = () => {
    return D.test.coin
    ? [D.coin.test.btcTestNet3, D.coin.test.ethRinkeby, D.coin.test.eosJungle]
    : [D.coin.main.btc, D.coin.main.eth, D.coin.main.eos]
}

// configure recover coins on first init, deault follows D.supportedCoinTypes
D.recoverCoinTypes = () => D.supportedCoinTypes()
```

2. Connect Device and Initialize
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

let esWallet = new EsWallet() // return wallet singleton

esWallet.listenTxInfo((error, txInfo) => {
// All the new transaction and updated exist transaction will be sent by this callback.
// You can add or update this transaction or call account.getTxInfos()
// to get all the newest transaction.
})

esWallet.listenStatus(function (error, status, data) {
  // return the connecting status of the wallet
  if (error !== D.error.succeed) {
    console.warn('error occured', error, status)
    return
    }
  switch (status) {
    case D.status.plugIn:
      console.log('device connected')
      // The device has connected. if you are using software wallet,
      // this will immediately callback asynchronously after calling
      // esWallet.listenStatus().
      break
    case D.status.initializing:
      console.log('wallet is initializing')
      // SDK will load account infos (e.g. balance and transactions) from device
      // and database in this step.
      // Just wait for SDK to finish.
      break
    case D.status.deviceChange:
      console.log('this new device is not the device you are viewing')
      // You will only get this event if you called enterOfflineMode() viewing
      // last connected device data and connect a different device.
      // TODO refresh data on App
      break
    case D.status.auth:
      console.log('show auth code on the screen and confirmed on device', data)
      // hardware wallet needs to confirm pairing on first time connect.
      // In this case data is a string pairing code. e.g. data = "4029".
      // Software wallet won't get this event.
      // TODO show auth code on scrren
      break
    case D.status.authFinish:
      console.log('authenticate finished')
      // Get this event when confirmed auth code on device by clicking "OK".
      // Software wallet won't get this event.
      break
    case D.status.syncing:
      console.log('wallet is synchronizing')
      // SDK has finish initializing and start synchronizing.
      // SDK will synchronize wallet balance and transaction to local database.
      // All the new transactions will be sent by esWallet.listenTxInfo().
      break
    case D.status.syncingNewAccount:
      console.log('checking transactions for account', data)
      // Get this event when SDK is syncing a new account.
      // In this case data is an Account object, Account usage is described below.
      // TODO show synchronizing status on screen
      break
    case D.status.syncFinish:
      console.log('wallet has finished synchronize')
      // The wallet are ready to use.
      break
    }
}
```

3. Initialize without Connecting Device
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

let esWallet = new EsWallet() // return wallet singleton

esWallet.listenStatus((error, status) => {
  // listen status first, see usage 2. for more details.
  // if the deivce connected in the future, this callback will be called again.
  
  // you should handle some specific errors in offline mode
  if (e === D.errror.offlineModeNotAllowed) {
    console.log('you have not connect a device before')
    // It's unable to get wallet data before connecting a device once.
  } else if (e === D.error.networkUnavailable) {
    console.log('the network is unavailble')
    // can not access the blockchain network.
    // It's ok if you just want to view transaction history
  } else {
    throw e
  }
}

esWallet.listenTxInfo((error, txInfo) => {
  // All the new transaction and updated exist transaction will be sent by this callback.
  // You can add or update this transaction or call account.getTxInfos()
  // to get all the newest transaction.
})

try {
  // Enter offline mode will trigger EsWallet initialize process except
  // the parts that needs to communicate with device.
  await esWallet.enterOfflineMode()
  // Now just handle event in esWallet.listenStatus().
} catch (e) {
  if (e === D.error.offlineModeUnnecessary) {
    console.log('the device has connected')
    // The device has connected, so just wait for synchronization to complete.
  }
  throw e
}
```

4. Use Wallet after Initialization
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

let coinTypes = EsWallet.supportedCoinTypes()
// return supported coins. e.g. ['btc', 'eth'] or ['btc_testnet3', 'eth_rinkeby'] for testnet
// available coins are listed in D.coin

let legals = EsWallet.supportedLegals()
// return supported legals. e.g. ['USD', 'EUR', 'CNY', 'JPY']
// available legals are listed in D.unit.legal

let esWallet = new EsWallet() // return wallet singleton
let walletInfo = await esWallet.getWalletInfo()
// return version info of wallet

let value = esWallet.convertValue(coinType, value, fromType, toType)
// convert value from A unit to B unit. support convertion of digital <=> legal

let coinTypes = await esWallet.availableNewAccountCoinTypes()
// return available coin types that can generate new account. only the first account and 
// account that last account has transations can be created.
let account = await esWallet.newAccount(coinType)
// return new account if the coin type is available to create new account
```

5. Use Accounts after Initialization
```
import {D, EsWallet} from 'esecubit-wallet-sdk'

let accounts = await esWallet.getAccounts()
let account = accounts[0]
// get all accounts that may have different coin types

await account.sync()
// check out new transaction for this account

let txInfos = await account.getTxInfos()
// get all transactions of this account

let {address, qrAddress} = await account.getAddress()
// get address that can receive coins. qrAddress is data show in QR code

let fee = account.getSuggestedFee()
// return suggested fee level e.g. {fast: 1, normal: 2, ecomic: 4}
// EOS transfer transaction without fee, so it's unavailable for EOS.

account.checkAddress(address)
// checkout whether address is legal.
// btc supported address: P2PBK address, P2SH address, P2PK (xpub/tpub)
// throw D.error.noAddressCheckSum if eth address don't have checksum(all upper/lower case)
// throw D.error.invalidAddressChecksum if address checksum incorrect
// throw D.error.invalidAddress if address has invalid format

// send transaction

// BTC
let details = {
  feeRate: '1', // santoshi per byte
  outputs:[{
    address:'mqaNwCJA6GU6X8wM48p8QxPJ8aghYaK7e1' // testnet address
    value: '100000'
  }], // santoshi
  }
// ETH
details = {
  feeRate: '1000000000', // wei
  outputs:[{
    address:'0x641C134F546A138805191866877E74f84aeef194'
    value: '1000000000000000'
  }], // wei
  }
let prepareTx = await account.prepareTx(details)
// return the fee that need to pay and utxos that going to use
let signedTx = await account.signTx(prepareTx)
// return the signedTx that going to boardcast
// you need to input pin and confirm the transaction if you are using hardware wallet
await account.sendTx(signedTx)
// boardcast the tx



// for EOS only
let isRegistered = account.isRegistered()
let permission = await account.getPermissions()
// Return permissions that relative to this account. Return default permissions
// if isRegistered = false.

// check EOS permission change
let permissionChanged = await account.checkAccountPermissions((error, status, data) => {
  // Permissions need to be add to device before signing transaction.
  // Add/Remove permissions need confirm on device.
  // This callback will return permissions info before you need to confirm on device.
  
  if (error != D.error.succeed) {
    console.log('somethings wrong', error, status)
    return
  }
  if (status === D.status.newEosPermissions) {
    console.log('these permissions need to confirm on device', data)
    // TODO show will confirmed permissions on screen
  } else if (status === D.status.confirmedEosPermission) {
    console.log('confirmed permission', data)
    // TODO update permissions confirmation status
  }
})

// If the threhold or  weight of permissions is changed, permissionChanged will
// also be true. but these changes don't need device confirmation so the callback
// won't return anything. These changes are stored in local database.
if (permissionChanged) {
  console.log('permissions changed')
} else {
  console.log('permissions not changed')
}

// EOS transaction
details = {
  type: 'tokenTransfer' // see D.coin.params.eos.actionTypes
  token: 'EOS', // only support EOS token for now, will add custom token function in future
  outputs:[{
    account:'esecubit1111'
    value: '2.12'
  }],
}
let prepareTx = await account.prepareTx(details)
// return the raw transaction to be signed

// or use specific interface
prepareTx = await account.prepareTransfer({
  token: 'EOS', // only support EOS token for now, will add custom token function in future
  outputs:[{
    account:'esecubit1111'
    value: '2.12'
  }],
})
// others like: prepareDelegate, prepareBuyRam, prepareVote, prepareOther are also supported

let signedTx = await account.signTx(prepareTx)
// return the signedTx that going to boardcast
// you need to input pin and confirm the transaction if you are using hardware wallet
await account.sendTx(signedTx)
// boardcast the tx

```

## Layout

```
.
├── build // webpack build config 
├── dist
│   └── eswallet.js // compiled sdk (no ES6/7)
├── src
│   ├── sdk
│   │   ├── D.js // constant and utils
│   │   ├── EsWallet.js //   implementation of Wallet
│   │   ├── Provider.js  // define the   implementation class of database, transmitter and driver
│   │   ├── Settings.js // storing app preferences
|   |   ├── account
│   │   |   ├── BtcAccount.js //   implementation of BTC account management
│   │   |   ├── BtcCoinSelect.js // algorithm of selecting utxos
│   │   │   ├── EthAccount.js //   implementation of ETH account management
│   │   │   ├── EOSAccount.js //   implementation of EOS account management
│   │   │   └── IAccount.js // base class of account management
│   │   ├── data
│   │   │   ├── CoinData.js // blockchain data manager
│   │   │   ├── database
│   │   │   │   ├── IDatabase.js // base class of database
│   │   │   │   └── IndexedDB.js //   implementation of database based on IndexedDB
│   │   │   └── network
│   │   │       ├── BlockChainInfo.js //   implementation btc blockchain network based on blockchain.info
│   │   │       ├── ChainSo.js //   implementation BTC blockchain network based on chain.so
│   │   │       ├── EtherScanIo.js //   implementation ETH network based on etherscan.io
│   │   │       ├── EosPeer.js //   implementation EOS network based on standard EOS peer
│   │   │       ├── ICoinNetwork.js // base class of blockchain network
│   │   │       ├── exchange
│   │   │       │   └── ExchangeCryptoCompareCom.js // getting exchange from cryptocompare.com
│   │   │       └── fee
│   │   │           ├── EthGasStationInfo.js // getting ETH suggested fee from ethgasstation.info
│   │   │           └── FeeBitCoinEarn.js // getting BTC suggested fee from bitcoinearn.com
│   │   └── device
│   │       ├── CoreWallet.js // the device managerment interface
│   │       └──   implements
│   │           ├── JsWallet.js //   implementation of software wallet
│   │           ├── S300Wallet.js //   implementation of MK12/S300 hardware wallet
│   │           ├── NetBankWallet.js //   implementation of native hardware wallet
│   │           ├── transmitter
│   │           │   ├── CcidTransmitter.js // transmit command to device through CCID protocol
│   │           │   ├── HidTransmitter.js // transmit command to device through HID protocol
│   │           │   ├── JsTransmitter.js // JsWallet virtual transmitter
│   │           │   ├── MockTransmitter.js // mock transmitter
│   │           │   ├── io
│   │           │   │   ├── ChromeHidDevice.js // Chrome HID driver
│   │           │   │   ├── ChromeUsbDevice.js // Chrome USB driver (unreliable)
│   │           │   │   └── MockDevice.js // mock driver
│   │           ├── protocol
│   │           │   ├── Authenticate.js //   implementation of Bluetooth device custom authenticate protocol
│   │           │   ├── Crypto.js //   implementation of cyrpto algorithms
│   │           │   ├── EosFcBuffer.js // EOS transaction serial protocol
│   │           │   ├── HandleShare.js // hardware device SSL
│   │           │   └── jsencrypt.js //   implementation of RSA encryption
│   └── test  // test files (unreliable for now)
└── test // mocha test framework
```
