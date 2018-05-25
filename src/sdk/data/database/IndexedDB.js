
const D = require('../../D').class
const Database = require('./IDatabase').class

const DB_VERSION = 3

const IndexedDB = function (walletId) {
  this._db = null
  this._walletId = walletId
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

    let finished = false
    let openRequest = indexedDB.open(this._walletId, DB_VERSION)
    openRequest.onupgradeneeded = (e) => {
      console.log('indexedDB upgrading...')
      let db = e.target.result

      /**
       * account:
       * {
       *   accountId: string,
       *   label: string,
       *   coinType: string,
       *   balance: long,
       *   extendPublicKey: string,
       *   extendPublicKeyIndex: int,
       *   changePublicKey: string,
       *   changePublicKeyIndex: int
       * }
       */
      if (!db.objectStoreNames.contains('account')) {
        let account = db.createObjectStore('account', {keyPath: 'accountId'})
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
        let txInfo = db.createObjectStore('txInfo', {keyPath: 'txId'})
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
        let addressInfo = db.createObjectStore('addressInfo', {keyPath: 'address'})
        addressInfo.createIndex('accountId', 'accountId', {unique: false})
        addressInfo.createIndex('coinType', 'coinType', {unique: false})
      }

      /**
       * utxo:
       * {
       *   accountId: string,
       *   coinType: string,
       *   address: string,
       *   path: string,
       *   txId: string,
       *   index: int,
       *   script: string,
       *   value: long (santoshi)
       * }
       */
      if (!db.objectStoreNames.contains('utxo')) {
        let utxo = db.createObjectStore('utxo', {keyPath: ['txId', 'address']})
        utxo.createIndex('accoundId', 'accoundId', {unique: false})
      }
    }

    openRequest.onsuccess = (e) => {
      console.log('indexedDB open success!')
      this._db = e.target.result
      finished++ || resolve()
    }

    openRequest.onerror = (e) => {
      console.warn('indexedDB open error', e)
      finished++ || reject(D.ERROR_DATABASE_OPEN_FAILED)
    }

    setTimeout(() => {
      finished || console.warn('open database time exceed, database maybe not closed')
      finished++ || reject(D.ERROR_DATABASE_OPEN_FAILED)
    }, 1900)
  })
}

IndexedDB.prototype.deleteDatabase = function () {
  return new Promise((resolve, reject) => {
    let finished = false
    let deleteRequest = indexedDB.deleteDatabase(this._walletId)
    deleteRequest.onsuccess = function () {
      console.log('indexedDB delete succeed')
      finished++ || resolve()
    }
    deleteRequest.onerror = function (ev) {
      console.log('indexedDB delete failed', ev)
      finished++ || reject(D.ERROR_DATABASE_OPEN_FAILED)
    }

    setTimeout(() => {
      finished || console.warn('deleteDatabase database time exceed, database maybe not closed')
      finished++ || reject(D.ERROR_DATABASE_OPEN_FAILED)
    }, 1900)
  })
}

IndexedDB.prototype.release = async function () {
  if (!this._db) return
  this._db.close()
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

IndexedDB.prototype.getAccounts = function (filter = {}) {
  return new Promise((resolve, reject) => {
    if (this._db === null) {
      reject(D.ERROR_DATABASE_OPEN_FAILED)
      return
    }

    let request
    if (filter.accountId) {
      request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .index('accountId')
        .getAll(filter.accountId)
    } else {
      request = this._db.transaction(['account'], 'readonly')
        .objectStore('account')
        .getAll()
    }

    request.onsuccess = (e) => {
      resolve(e.target.result)
    }
    request.onerror = (e) => {
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
      .put(txInfo)

    request.onsuccess = () => {
      resolve(txInfo)
    }
    request.onerror = (e) => {
      console.warn('saveOrUpdateTxInfo', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, txInfo)
    }
  })
}

IndexedDB.prototype.getTxInfos = function (filter = {}) {
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
    let startIndex = filter.startIndex || 0
    let endIndex = filter.endIndex || Number.MAX_SAFE_INTEGER
    request.onsuccess = (e) => {
      let cursor = e.target.result
      if (!cursor) {
        resolve([total, array])
        return
      }
      if (total >= startIndex && total < endIndex) {
        array.push(cursor.value)
        total++
      }
      cursor.continue()
    }
    request.onerror = (e) => {
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
      .put(addressInfo)

    request.onsuccess = () => {
      resolve(addressInfo)
    }
    request.onerror = (e) => {
      console.log('saveOrUpdateAddressInfo', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED, addressInfo)
    }
  })
}

IndexedDB.prototype.getAddressInfos = function (filter = {}) {
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
        .getAll(filter.coinType)
    } else {
      request = this._db.transaction(['addressInfo'], 'readonly')
        .objectStore('addressInfo')
        .getAll()
    }

    request.onsuccess = (e) => {
      resolve(e.target.result)
    }
    request.onerror = (e) => {
      console.warn('getAddressInfos', e)
      reject(D.ERROR_DATABASE_EXEC_FAILED)
    }
  })
}

IndexedDB.prototype.newTx = function (addressInfo, txInfo, utxo) {
  return new Promise((resolve, reject) => {
    let objectStores = ['addressInfo', 'txInfo', 'utxo']
    let transaction = this._db.transaction(objectStores, 'readwrite')
    let request = transaction.objectStore('addressInfo').put(addressInfo)
    let error = (e) => {
      console.warn(e)
      reject(e)
    }
    request.onsuccess = () => {
      let request2 = transaction.objectStore('txInfo').put(txInfo)
      request2.onsuccess = () => {
        if (utxo) {
          let request3 = transaction.objectStore('utxo').put(utxo)
          request3.onsuccess = () => {
            resolve(addressInfo, txInfo, utxo)
          }
          request3.onerror = error
        } else {
          resolve(addressInfo, txInfo)
        }
      }
      request2.onerror = error
    }
    request.onerror = error
  })
}
