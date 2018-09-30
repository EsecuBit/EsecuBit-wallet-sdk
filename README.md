# EsecuBit-wallet-sdk

## Introduction

A JavaScript SDK for EsecuBit
digital currency wallet. Supporting Apps: [EsecuBit React Native Wallet (Android, iOS)](https://github.com/EsecuBit/EsecuBit-react-native-wallet), [EsecuBit Chrome Wallet](https://github.com/EsecuBit/EsecuBit-chrome-wallet).

EsecuBit Wallet SDK supports both hardware wallet ([EsecuBit hardware wallet](http://www.esecubit.com/)) and software wallet (default software wallet). **But the security of software wallet is not guaranteed, the seed is stored in plain text in database**. It's just for test usage.

EsecuBit Wallet SDK supports mainnet and testnet (default testnet).

EsecuBit Wallet SDK using ES6/7 features.

## Supported Digital Currencies

* Bitcoin (BTC)
* Ethereum (ETH)

**COMING SOON**

* Bitcoin Cash (BCH)
* Litecoin (LTC)
* EOS (EOS)
* Dash (DASH)
* ZCash (ZEC)
* Ripple (XRP)

## Blockchain API Provider

BTC:
* [blockchain.com](https://www.blockchain.com)
* [chain.so](https://chain.so/) (not fully tested)

ETH:
* [etherscan.io](https://etherscan.io/)

## Other API Provider

BTC Fee:
* [bitcoinfees.earn.com](https://bitcoinfees.earn.com/)

ETH Fee:
* [ethgasstation.info](https://ethgasstation.info/)

Digital Currency Exchange:
* [cryptocompare.com](https://cryptocompare.com/)

## Import SDK

1. Add dependency in package.json -> dependencies
```javascript
dependencies {
  "esecubit-wallet-sdk": "git+https://github.com/EsecuBit/EsecuBit-wallet-sdk.git"
  // or:
  // "esecubit-wallet-sdk": "git+ssh://github.com/EsecuBit/EsecuBit-wallet-sdk.git"
}
```

2. Install
```shell
npm install
```

3. Import
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'
```

If you are runing on a low version of Chrome (<= 54), you may need to use the compiled version.

Add it in the webpack.config:
```javascript
resolve: {
  alias: {
    "esecubit-wallet-sdk": "esecubit-wallet-sdk/dist/eswallet"
  }
}

```

Then import:

```
import {D, EsWallet} from 'esecubit-wallet-sdk'
```

Or import compiled SDK directly like this:

```
import {D, EsWallet} from 'esecubit-wallet-sdk/dist/eswallet'
```

## Usage

1. SDK Configuration
```javascript
import {D} from 'esecubit-wallet-sdk'

// configure it before call EsWallet
D.test.jsWallet = true // use javascript wallet, default false (hardware wallet)
D.test.testCoin = true // use testnet, dafault false (mainnet)
```

2. Connect Device and Finish Initialization
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

let esWallet = new EsWallet() // return wallet singleton
esWallet.listenStatus(function (error, status) {
    // return the connecting status of the wallet
    if (error !== D.error.succeed) {
      console.warn('error occured', error, status)
      return
    }
    switch (status) {
        case D.status.plugIn:
            console.log('device connected')
            // the device has connected. if you are using software wallet, this will immediately callback asynchronously after calling esWallet.listenStatus()
            break
        case D.status.initializing:
            console.log('wallet is initializing')
            break
        case D.status.deviceChange:
            console.log('this new device is not the device you are viewing')
            // you will only get this if you called enterOfflineMode() and connect a different device
            // refresh data
            break
        case D.status.syncing:
            console.log('wallet is synchronizing')
            break
        case D.status.syncFinish:
            console.log('wallet has finished synchronize')
            // the wallet data and device are ready to use
            break
    }
}

esWallet.listenTxInfo(function (error, txInfo) {
  // all the new transaction and updated exist transaction will be sent by this callback
  // you can add or update this transaction or call account.getTxInfos to get the newest transactions
})
```

3. Initialize without Connecting Device
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

let esWallet = new EsWallet() // return wallet singleton

try {
  await esWallet.enterOfflineMode()
} catch (e) {
  if (e === D.errror.offlineModeNotAllowed) {
    console.log('you have not connect a device before')
    // if you don't have connected before, it's unable to get wallet data
  } else if (e === D.error.offlineModeUnnecessary) {
    console.log('the device has connected')
    // the device has connected, so just wait for synchronization to complete
  } else if (e === D.error.networkUnavailable) {
    console.log('the network is unavailble')
    // can not access the blockchain network. it's ok if you just want to view transaction history
  } else {
    throw e
  }
}
// the wallet data are ready to use

esWallet.listenStatus((error, status) => {
  // you still need to listen status.
  // if the deivce connected in the future, this callback will be called.
  // see usage 2. for more details.
}

esWallet.listenTxInfo((error, txInfo) => {
  // all the new transaction and updated exist transaction will be sent by this callback
  // you can add or update this transaction or call account.getTxInfos to get all the newest transaction
})
```

4. Use Wallet after Initialization
```javascript
import {D, EsWallet} from 'esecubit-wallet-sdk'

// wallet

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


// account

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

account.checkAddress(address)
// checkout whether addres is legal.
// btc supported address: P2PBK address, P2SH address, P2PK (xpub/tpub)
// throw D.error.noAddressCheckSum if eth address don't have checksum(all upper/lower case)
// throw D.error.invalidAddressChecksum if address checksum incorrect
// throw D.error.invalidAddress if address has invalid format

// send transaction

// btc
let details = {
  feeRate: '1', // santoshi per byte
  outputs:[
    address:'mqaNwCJA6GU6X8wM48p8QxPJ8aghYaK7e1' // testnet address
    value: '100000'], // santoshi
  }
// eth
details = {
  feeRate: '1000000000', // wei
  outputs:[
    address:'0x641C134F546A138805191866877E74f84aeef194'
    value: '1000000000000000'], // wei
  }
let prepareTx = await account.prepareTx(details)
// return the fee that need to pay and utxos that going to use
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
│   │   ├── BtcAccount.js // implement of BTC account management
│   │   ├── BtcCoinSelect.js // algorithm of selecting utxos
│   │   ├── D.js // constant and utils
│   │   ├── EsWallet.js // implement of Wallet
│   │   ├── EthAccount.js // implement of ETH account management
│   │   ├── Provider.js  // define the implement class of database, transmitter and driver
│   │   ├── Settings.js // storing app preferences
│   │   ├── data
│   │   │   ├── CoinData.js // blockchain data manager
│   │   │   ├── database
│   │   │   │   ├── IDatabase.js // base class of database
│   │   │   │   └── IndexedDB.js // implement of database based on IndexedDB
│   │   │   └── network
│   │   │       ├── BlockChainInfo.js // implement btc blockchain network based on blockchain.info
│   │   │       ├── ChainSo.js // implement btc blockchain network based on chain.so
│   │   │       ├── EtherScanIo.js // implement eth network based on etherscan.io
│   │   │       ├── ICoinNetwork.js // base class of blockchain network
│   │   │       ├── exchange
│   │   │       │   └── ExchangeCryptoCompareCom.js // getting exchange from cryptocompare.com
│   │   │       └── fee
│   │   │           ├── EthGasStationInfo.js // getting ETH suggested fee from ethgasstation.info
│   │   │           └── FeeBitCoinEarn.js // getting BTC suggested fee from bitcoinearn.com
│   │   └── device
│   │       ├── CoreWallet.js // implement of hardware wallet
│   │       ├── JsWallet.js // implement of software wallet
│   │       ├── fat // hardware custom data management
│   │       └── transmit
│   │           ├── HidTransmitter.js // transmit command to device through HID protocol (kind of USB)
│   │           ├── MockTransmitter.js // mock transmitter
│   │           ├── io
│   │           │   ├── ChromeHidDevice.js // Chrome HID driver
│   │           │   ├── ChromeUsbDevice.js // Chrome USB driver (unreliable)
│   │           │   ├── IEsDevice.js // base class of device driver
│   │           │   └── MockDevice.js // mock driver
│   │           └── jsencrypt.js // implement of RSA encryption. copied from JSEncrypt and modified.
│   └── test  // test files (unreliable for now)
├── test // mocha test files
```
