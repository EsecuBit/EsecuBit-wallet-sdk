
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
       *   coinType: string
       * }
       */
      if (!db.objectStoreNames.contains('account')) {
        let account = db.createObjectStore('account', {autoIncrement: true})
        account.createIndex('deviceId, passPhraseId', ['deviceId', 'passPhraseId'], {unique: false})
        account.createIndex('coinType', 'coinType', {unique: false})
      }

      /**
       * transactionInfo:
       * {
       *   accountId: string,
       *   coinType: string,
       *   txId: string,
       *   version: int,
       *   blockNumber: int,
       *   confirmations: int, // just for showing the status. won't active update after confirmations >= D.TRANSACTION_##COIN_TYPE##_MATURE_CONFIRMATIONS
       *   lockTime: long,
       *   time: long,
       *   direction: D.TRANSACTION_DIRECTION_IN / D.TRANSACTION_DIRECTION_OUT,
       *   inputs: in array [{prevAddress, isMine, value}]
       *   outputs: out array [{address, isMine, value}]
       *   value: long (bitcoin -> santoshi) // value that shows the account balance changes, calculated by inputs and outputs
       * }
       */
      // TODO createIndex when upgrade?
      if (!db.objectStoreNames.contains('transactionInfo')) {
        let transactionInfo = db.createObjectStore('transactionInfo', {autoIncrement: true})
        transactionInfo.createIndex('accountId', 'accountId', {unique: false})
        transactionInfo.createIndex('txId', 'txId', {unique: false})
        transactionInfo.createIndex('time', 'time', {unique: false})
      }

      /**
       * addressInfo:
       * {
       *   address: string,
       *   accountId: string,
       *   coinType: string,
       *   path: int array,
       *   type: D.ADDRESS_EXTERNAL / D.ADDRESS_CHANGE,
       *   txCount: int,
       *   balance: long (santoshi),
       *   txs: [{txId, direction, hasSpent, index, script}]
       * }
       */
      if (!db.objectStoreNames.contains('addressInfo')) {
        let addressInfo = db.createObjectStore('addressInfo')
        addressInfo.createIndex('accountId', 'accountId', {unique: false})
        addressInfo.createIndex('coinType', 'coinType', {unique: false})
        addressInfo.createIndex('type', 'type', {unique: false})
        addressInfo.createIndex('accountId, type', ['accountId', 'type'], {unique: false})
        addressInfo.createIndex('coinType, type', ['coinType', 'type'], {unique: false})
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

IndexedDB.prototype.saveOrUpdateTransactionInfo = function (transactionInfo) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request = this._db.transaction(['transactionInfo'], 'readwrite')
      .objectStore('transactionInfo')
      .add(transactionInfo)

    request.onsuccess = function () {
      resolve(transactionInfo)
    }
    request.onerror = function (e) {
      console.warn('saveOrUpdateTransactionInfo', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, transactionInfo)
    }
  })
}

IndexedDB.prototype.getTransactionInfos = function (filter) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request
    if (filter.accountId !== null) {
      // var range = IDBKeyRange.bound(startIndex, endIndex)
      request = this._db.transaction(['transactionInfo'], 'readonly')
        .objectStore('transactionInfo')
        .index('accountId')
        .openCursor(filter.accountId)
      // TODO optimize
      // .openCursor(range)
    } else {
      request = this._db.transaction(['transactionInfo'], 'readonly')
        .objectStore('transactionInfo')
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
      console.log('getTransactionInfos', e)
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
