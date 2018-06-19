
import IDatabase from './IDatabase'
import D from '../../D'

const DB_VERSION = 5
export default class IndexedDB extends IDatabase {
  constructor (walletId) {
    super()
    if (IndexedDB.pool[walletId]) {
      console.log('return exists instance', IndexedDB.pool[walletId])
      return IndexedDB.pool[walletId]
    }
    IndexedDB.pool[walletId] = this

    this._db = null
    this._walletId = walletId
    this._finished = true
  }

  init () {
    return new Promise(async (resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('no indexedDB implementation')
        reject(D.error.databaseOpenFailed)
        return
      }
      if (this._db) {
        resolve()
        return
      }
      while (!this._finished) await D.wait(10)
      if (this._db) {
        resolve()
        return
      }
      this._finished = false

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
         *   index: 0,
         *   balance: long,
         *   externalPublicKey: string,
         *   externalPublicKeyIndex: int, // next external address index
         *   changePublicKey: string,
         *   changePublicKeyIndex: int // next change address index
         * }
         */
        if (!db.objectStoreNames.contains('account')) {
          let account = db.createObjectStore('account', {keyPath: 'accountId'})
          account.createIndex('coinType', 'coinType', {unique: false})
        }

        /**
         * txInfo:
         * btc：
         * {
         *   accountId: string,
         *   coinType: string,
         *   txId: string,
         *   version: int,
         *   blockNumber: int,
         *   confirmations: int, // -1: not found in btcNetwork, 0: found in miner's memory pool. other: confirmations
         *                  just for showing the status. won't active update after confirmations >= D.TRANSACTION_##coin.TYPE##_MATURE_CONFIRMATIONS
         *   time: number,
         *   direction: D.tx.direction.in / D.tx.direction.out,
         *   inputs: [{prevAddress, prevOutIndex, index, value, isMine}, ...]
         *   outputs: [{address, index, value, isMine}, ...]
         *   value: number (btc -> santoshi) // value that shows the account balance changes, calculated by inputs and outputs
         * }
         *
         * eth：
         * {
         *   accountId: string,
         *   coinType: string,
         *   txId: string,
         *   version: number,
         *   blockNumber: number,
         *   confirmations: number, // -1: not found in btcNetwork, 0: found in miner's memory pool. other: confirmations
         *                  just for showing the status. won't active update after confirmations >= D.TRANSACTION_##coin.TYPE##_MATURE_CONFIRMATIONS
         *   time: number,
         *   direction: D.tx.direction.in / D.tx.direction.out,
         *   inputs: [{prevAddress, prevOutIndex, index, value, isMine}, ...]
         *   outputs: [{address, index, value, isMine}, ...]
         *   value: number (btc -> santoshi) // value that shows the account balance changes, calculated by inputs and outputs
         *   gas: number,
         *   gasPrice: number,
         *   fee: gas * gasPrice
         * }
         */
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
         *   type: D.address.external / D.address.change,
         *   index: int,
         *   txs: txId (string) array
         * }
         */
        if (!db.objectStoreNames.contains('addressInfo')) {
          let addressInfo = db.createObjectStore('addressInfo', {keyPath: 'address'})
          addressInfo.createIndex('accountId', 'accountId', {unique: false})
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
         *   value: long (santoshi),
         *   spent: D.utxo.status.unspent / D.SPENT_PENDING / D.utxo.status.spent
         * }
         */
        if (!db.objectStoreNames.contains('utxo')) {
          let utxo = db.createObjectStore('utxo', {keyPath: ['txId', 'index']})
          utxo.createIndex('accountId', 'accountId', {unique: false})
          utxo.createIndex('accountId, spent', ['accountId', 'spent'], {unique: false})
        }

        /**
         * fee:
         * {
         *   coinType: string,
         *   fee: object // (btc: {fast: int, normal: int, ecnomic: int})
         * }
         */
        if (!db.objectStoreNames.contains('fee')) {
          db.createObjectStore('fee', {keyPath: 'coinType'})
        }

        /**
         * exchange:
         * {
         *   coinType: string,
         *   unit: string,
         *   exchange: object // (btc: {USD: float, EUR: float, JPY: float, legal.CNY: float})
         * }
         */
        if (!db.objectStoreNames.contains('exchange')) {
          db.createObjectStore('exchange', {keyPath: 'coinType'})
        }
      }

      openRequest.onsuccess = (e) => {
        console.log('indexedDB open success!')
        this._db = e.target.result
        this._finished++ || resolve()
      }

      openRequest.onerror = (e) => {
        console.warn('indexedDB open error', e)
        this._finished++ || reject(D.error.databaseOpenFailed)
      }

      setTimeout(() => {
        this._finished || console.warn('open database time exceed, database maybe not closed')
        this._finished++ || reject(D.error.databaseOpenFailed)
      }, 1900)
    })
  }

  /**
   * Won't do anything in release. Will keep the connection until app closed
   */
  async release () {
    // do nothing
  }

  clearDatabase () {
    return new Promise((resolve, reject) => {
      let transaction = this._db.transaction(['account', 'txInfo', 'addressInfo', 'utxo'], 'readwrite')
      let error = (ev) => {
        console.warn('clearDatabase', ev)
        reject(D.error.databaseExecFailed)
      }
      let request = transaction.objectStore('account').clear()
      request.onerror = error
      request.onsuccess = () => {
        let request = transaction.objectStore('txInfo').clear()
        request.onerror = error
        request.onsuccess = () => {
          let request = transaction.objectStore('addressInfo').clear()
          request.onerror = error
          request.onsuccess = () => {
            let request = transaction.objectStore('utxo').clear()
            request.onerror = error
            request.onsuccess = () => {
              resolve()
            }
          }
        }
      }
    })
  }

  // noinspection JSUnusedGlobalSymbols
  deleteDatabase () {
    this._db = null
    return new Promise((resolve, reject) => {
      let finished = false
      let deleteRequest = indexedDB.deleteDatabase(this._walletId)
      deleteRequest.onsuccess = () => {
        console.log('indexedDB delete succeed')
        finished++ || resolve()
      }
      deleteRequest.onerror = (ev) => {
        console.log('indexedDB delete failed', ev)
        finished++ || reject(D.error.databaseOpenFailed)
      }

      setTimeout(() => {
        finished || console.warn('deleteDatabase database time exceed, database maybe not closed')
        finished++ || reject(D.error.databaseOpenFailed)
      }, 1900)
    })
  }

  newAccount (account) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['account'], 'readwrite')
      let request = transaction.objectStore('account').add(account)
      request.onsuccess = resolve
      request.onerror = (e) => {
        console.warn('newAccount', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  deleteAccount (account, addressInfos) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['account', 'addressInfo'], 'readwrite')
      let accountRequest = () => {
        return new Promise((resolve, reject) => {
          let request = transaction.objectStore('account').delete(account.accountId)
          request.onsuccess = resolve
          request.onerror = reject
        })
      }
      let addressInfosRequest = () => {
        return Promise.all(addressInfos.map(addressInfo => new Promise((resolve, reject) => {
          let request = transaction.objectStore('addressInfo').delete(addressInfo.address)
          request.onsuccess = resolve
          request.onerror = reject
        })))
      }

      accountRequest().then(addressInfosRequest).then(resolve).catch(e => {
        console.warn('newAddressInfos', e)
        reject(D.error.databaseExecFailed)
      })
    })
  }

  getAccounts (filter = {}) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let request
      if (filter.accountId) {
        request = this._db.transaction(['account'], 'readonly')
          .objectStore('account')
          .getAll(filter.accountId)
      } else if (filter.coinType) {
        request = this._db.transaction(['account'], 'readonly')
          .objectStore('account')
          .index('coinType')
          .getAll(filter.coinType)
      } else {
        request = this._db.transaction(['account'], 'readonly')
          .objectStore('account')
          .getAll()
      }

      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => {
        console.warn('getAccounts', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  renameAccount (account) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let request = this._db.transaction(['account'], 'readwrite')
        .objectStore('account')
        .get(account.accountId)

      let error = e => {
        console.warn('renameAccount', e)
        reject(D.error.databaseExecFailed)
      }

      request.onsuccess = e => {
        let oldAccount = e.target.result
        oldAccount.label = account.label

        let request = this._db.transaction(['account'], 'readwrite')
          .objectStore('account')
          .put(oldAccount)
        request.onsuccess = e => resolve(e.target.result)
        request.onerror = error
      }
      request.onerror = error
    })
  }

  saveOrUpdateTxInfo (txInfo) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
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
        reject(D.error.databaseExecFailed)
      }
    })
  }

  getTxInfos (filter = {}) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let request
      if (filter.accountId) {
        request = this._db.transaction(['txInfo'], 'readonly')
          .objectStore('txInfo')
          .index('accountId')
          .openCursor(filter.accountId)
      } else {
        request = this._db.transaction(['txInfo'], 'readonly')
          .objectStore('txInfo')
          .openCursor()
      }

      let total = 0
      let txInfos = []
      let startIndex = filter.startIndex || 0
      let endIndex = filter.endIndex || Number.MAX_SAFE_INTEGER
      request.onsuccess = (e) => {
        let cursor = e.target.result
        if (!cursor) {
          resolve({total, txInfos})
          return
        }
        if (total >= startIndex && total < endIndex) {
          txInfos.push(cursor.value)
        }
        total++
        cursor.continue()
      }
      request.onerror = (e) => {
        console.log('getTxInfos', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  newAddressInfos (account, addressInfos) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let accountRequest = () => {
        return new Promise((resolve, reject) => {
          let request = this._db.transaction(['account'], 'readwrite')
            .objectStore('account')
            .put(account)

          request.onsuccess = () => resolve(account)
          request.onerror = reject
        })
      }
      let addressInfosRequest = () => {
        return Promise.all(addressInfos.map(addressInfo => new Promise((resolve, reject) => {
          let request = this._db.transaction(['addressInfo'], 'readwrite')
            .objectStore('addressInfo')
            .add(addressInfo)

          request.onsuccess = resolve
          request.onerror = reject
        })))
      }

      accountRequest().then(addressInfosRequest).then(resolve).catch(e => {
        console.warn('newAddressInfos', e)
        reject(D.error.databaseExecFailed)
      })
    })
  }

  getAddressInfos (filter = {}) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let request
      if (filter.accountId) {
        request = this._db.transaction(['addressInfo'], 'readonly')
          .objectStore('addressInfo')
          .index('accountId')
          .getAll(filter.accountId)
      } else {
        request = this._db.transaction(['addressInfo'], 'readonly')
          .objectStore('addressInfo')
          .getAll()
      }

      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => {
        console.warn('getAddressInfos', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  getUtxos (filter = {}) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let request
      if (filter.accountId && filter.spent) {
        request = this._db.transaction(['utxo'], 'readonly')
          .objectStore('utxo')
          .index('accountId, spent')
          .getAll([filter.accountId, filter.spent])
      } else if (filter.accountId) {
        request = this._db.transaction(['utxo'], 'readonly')
          .objectStore('utxo')
          .index('accountId')
          .getAll(filter.accountId)
      } else {
        request = this._db.transaction(['utxo'], 'readonly')
          .objectStore('utxo')
          .getAll()
      }

      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => {
        console.warn('getAccounts', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  newTx (account, addressInfo, txInfo, utxos = []) {
    return new Promise((resolve, reject) => {
      let objectStores = ['account', 'addressInfo', 'txInfo', 'utxo']
      let transaction = this._db.transaction(objectStores, 'readwrite')

      let accountRequest = () => {
        return new Promise((resolve, reject) => {
          if (!account) {
            resolve()
            return
          }
          let request = transaction.objectStore('account').put(account)
          request.onsuccess = resolve
          request.onerror = reject
        })
      }
      let addressInfoRequest = () => {
        return new Promise((resolve, reject) => {
          if (!addressInfo) {
            resolve()
            return
          }
          let request = transaction.objectStore('addressInfo').put(addressInfo)
          request.onsuccess = resolve
          request.onerror = reject
        })
      }
      let txInfoRequest = () => {
        return new Promise((resolve, reject) => {
          let request = transaction.objectStore('txInfo').put(txInfo)
          request.onsuccess = resolve
          request.onerror = reject
        })
      }
      let utxoRequest = () => {
        return Promise.all(utxos.map(utxo => new Promise((resolve, reject) => {
          let request = transaction.objectStore('utxo').put(utxo)
          request.onsuccess = resolve
          request.onerror = reject
        })))
      }
      accountRequest().then(addressInfoRequest).then(txInfoRequest).then(utxoRequest)
        .then(resolve)
        .catch(ev => {
          console.warn('newTx', ev)
          reject(D.error.databaseExecFailed)
        })
    })
  }

  getFee (coinType) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['fee'], 'readonly')
      let request = transaction.objectStore('fee').get(coinType)
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => {
        console.warn('getFee', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  saveOfUpdateFee (fee) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['fee'], 'readwrite')
      let request = transaction.objectStore('fee').put(fee)
      request.onsuccess = resolve
      request.onerror = (e) => {
        console.warn('saveOfUpdateFee', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  getExchange (coinType) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['exchange'], 'readonly')
      let request = transaction.objectStore('exchange').get(coinType)
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => {
        console.warn('getExchange', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }

  saveOfUpdateExchange (exchange) {
    return new Promise((resolve, reject) => {
      if (this._db === null) {
        reject(D.error.databaseOpenFailed)
        return
      }

      let transaction = this._db.transaction(['exchange'], 'readwrite')
      let request = transaction.objectStore('exchange').put(exchange)
      request.onsuccess = resolve
      request.onerror = (e) => {
        console.warn('saveOfUpdateExchange', e)
        reject(D.error.databaseExecFailed)
      }
    })
  }
}
IndexedDB.pool = {}
