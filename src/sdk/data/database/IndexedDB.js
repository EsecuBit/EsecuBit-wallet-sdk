
const D = require('../../D').class
const Database = require('./IDatabase').class

const DB_VERSION = 3

const IndexedDB = function () {
  this._db = null
}
module.exports = {class: IndexedDB}

IndexedDB.prototype = new Database()

// TODO judge is new app, whether need recover wallet
IndexedDB.prototype.init = function () {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      console.warn('no indexedDB implementation')
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let openRequest = indexedDB.open('wallet', DB_VERSION)
    openRequest.onupgradeneeded = (e) => {
      console.log('indexedDB upgrading...')
      let db = e.target.result

      /**
       * account:
       * {
       *   accountId: string,
       *   label: string,
       *   deviceID: string,
       *   passPhraseID: string,
       *   coinType: string,
       *   balance: long,
       *   path: string, // TODO complete
       *   extendPublicKey: string,
       *   changePublicKey: string
       * }
       */
      if (!db.objectStoreNames.contains('account')) {
        let account = db.createObjectStore('account', {autoIncrement: true})
        account.createIndex('deviceId, passPhraseId', ['deviceId', 'passPhraseId'], {unique: false})
        account.createIndex('coinType', 'coinType', {unique: false})
      }

      /**
       * txInfo:
       * {
       *   accountId: string,
       *   coinType: string,
       *   txId: string,
       *   version: int,
       *   blockNumber: int,
       *   confirmations: int, // just for showing the status. won't active update after confirmations >= D.TRANSACTION_##COIN_TYPE##_MATURE_CONFIRMATIONS
       *   lockTime: long,
       *   time: long,
       *   direction: D.TX_DIRECTION_IN / D.TX_DIRECTION_OUT,
       *   inputs: in array [{prevAddress, isMine, value}]
       *   outputs: out array [{address, isMine, value}]
       *   value: long (bitcoin -> santoshi) // value that shows the account balance changes, calculated by inputs and outputs
       * }
       */
      // TODO createIndex when upgrade?
      if (!db.objectStoreNames.contains('txInfo')) {
        let txInfo = db.createObjectStore('txInfo', {autoIncrement: true})
        txInfo.createIndex('accountId', 'accountId', {unique: false})
        txInfo.createIndex('txId', 'txId', {unique: false})
        txInfo.createIndex('time', 'time', {unique: false})
      }

      /**
       * addressInfo:
       * {
       *   address: string,
       *   accountId: string,
       *   coinType: string,
       *   path: string,
       *   type: D.ADDRESS_EXTERNAL / D.ADDRESS_CHANGE,
       *   txCount: int,
       *   balance: long (santoshi),
       *   txs: txId (string) array
       * }
       */
      if (!db.objectStoreNames.contains('addressInfo')) {
        let addressInfo = db.createObjectStore('addressInfo')
        addressInfo.createIndex('accountId', 'accountId', {unique: false})
        addressInfo.createIndex('coinType', 'coinType', {unique: false})
      }

      /**
       * utxo:
       * {
       *   accoundId: string,
       *   address: string,
       *   path: string,
       *   txId: string,
       *   index: int,
       *   script: string,
       *   value: long (santoshi)
       * }
       */
      if (!db.objectStoreNames.contains('utxo')) {
        let utxo = db.createObjectStore('utxo', {autoIncrement: true})
        utxo.createIndex('accoundId', 'accoundId', {unique: false})
      }
    }

    openRequest.onsuccess = (e) => {
      console.log('indexedDB open success!')
      this._db = e.target.result
      resolve()
    }

    openRequest.onerror = (e) => {
      console.warn('indexedDB open error', e)
      reject(D.ERROR_DATABASE_OPEN_FAILED)
    }
  })
}

IndexedDB.prototype.saveAccount = function (account) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request = this._db.transaction(['account'], 'readwrite')
      .objectStore('account')
      .add(account)

    request.onsuccess = () => {
      resolve(account)
    }
    request.onerror = (e) => {
      console.warn('saveAccount', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, account)
    }
  })
}

IndexedDB.prototype.getAccounts = function (deviceId, passPhraseId) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request = this._db.transaction(['account'], 'readonly')
      .objectStore('account')
      .index('deviceId, passPhraseId')
      .getAll([deviceId, passPhraseId])

    request.onsuccess = function (e) {
      resolve(e.target.result)
    }
    request.onerror = function (e) {
      console.warn('getAccounts', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED)
    }
  })
}

IndexedDB.prototype.saveOrUpdateTxInfo = function (txInfo) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request = this._db.transaction(['txInfo'], 'readwrite')
      .objectStore('txInfo')
      .add(txInfo)

    request.onsuccess = function () {
      resolve(txInfo)
    }
    request.onerror = function (e) {
      console.warn('saveOrUpdateTxInfo', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, txInfo)
    }
  })
}

IndexedDB.prototype.getTxInfos = function (filter) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request
    if (filter.accountId !== null) {
      // var range = IDBKeyRange.bound(startIndex, endIndex)
      request = this._db.transaction(['txInfo'], 'readonly')
        .objectStore('txInfo')
        .index('accountId')
        .openCursor(filter.accountId)
      // TODO optimize
      // .openCursor(range)
    } else {
      request = this._db.transaction(['txInfo'], 'readonly')
        .objectStore('txInfo')
        .openCursor()
    }

    let total = 0
    let array = []
    let startIndex = filter.hasOwnProperty('startIndex') ? filter.startIndex : 0
    request.onsuccess = function (e) {
      let cursor = e.target.result
      if (!cursor) {
        resolve([total, array])
        return
      }
      if (total++ >= startIndex) {
        array.push(cursor.value)
      }
      cursor.continue()
    }
    request.onerror = function (e) {
      console.log('getTxInfos', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED)
    }
  })
}

IndexedDB.prototype.saveOrUpdateAddressInfo = function (addressInfo) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request = this._db.transaction(['addressInfo'], 'readwrite')
      .objectStore('addressInfo')
      .add(addressInfo, addressInfo.address)

    request.onsuccess = function () {
      resolve(addressInfo)
    }
    request.onerror = function (e) {
      console.log('saveOrUpdateAddressInfo', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, addressInfo)
    }
  })
}

IndexedDB.prototype.getAddressInfos = function (filter) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request
    if (filter.coinType !== null) {
      request = this._db.transaction(['addressInfo'], 'readonly')
        .objectStore('addressInfo')
        .index('coinType')
        .openCursor(filter.coinType)
    } else {
      request = this._db.transaction(['addressInfo'], 'readonly')
        .objectStore('addressInfo')
        .openCursor()
    }

    let array = []
    request.onsuccess = function (e) {
      let cursor = e.target.result
      if (!cursor) {
        resolve(array)
        return
      }

      array.push(cursor.value)
      cursor.continue()
    }
    request.onerror = function (e) {
      console.warn('getAddressInfos', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED)
    }
  })
}
