
import D from '../D'
import IAccount from './IAccount'
import {BigDecimal} from 'bigdecimal'

const tokenList = {
  'EOS': {
    name: 'EOS',
    account: 'eosio.token',
    precision: 4
  },
  'SYS': {
    name: 'SYS',
    account: 'eosio.token',
    precision: 4
  },
  'JUNGLE': {
    name: 'JUNGLE',
    account: 'eosio.token',
    precision: 4
  }
}

const txType = {
  tokenTransfer: 'tokenTransfer'
}

const maxIndexThreshold = 5

export default class EosAccount extends IAccount {
  constructor (info, device, coinData) {
    super(info, device, coinData)
    this._network = this._coinData.getNetwork(this.coinType)
    if (!this._network) {
      console.warn('EosAccount CoinData not support this network', this.coinType)
      throw D.error.invalidParams
    }
  }

  async sync (firstSync = false, offlineMode = false) {
    if (!offlineMode) {
      await this._checkPermissionAndGenerateNew()
    }

    if (!this.isRegistered()) {
      console.log('EosAccount not registered, check owner publickey')

      // slip-0048 recovery
      let i = 0
      for (; i < maxIndexThreshold; i++) {
        let path = D.address.path.makeSlip48Path(this.coinType, 0, this.index, i)
        let ownerInfo = this.addressInfos.find(a => a.path === path)
        if (!ownerInfo) {
          console.warn('account have no permission info in storage, most likely it is in offlineMode, exit')
          return
        }
        let accounts = await this._network.getAccountByPubKey(ownerInfo.publicKey)
        if (!accounts || accounts.length === 0) {
          console.info('EosAccount specific path not registered', ownerInfo)
        } else {
          // choose the first account if this key matches multi accounts
          // set the label as account name
          this.label = accounts[0]
          break
        }
        // slow down the request speed
        await D.wait(200)
      }
      if (i === maxIndexThreshold) {
        console.warn('this EosAccount has not been registered, exit')
        return
      }
    }

    this.tokens = this.tokens || {'EOS': {code: 'eosio.token', symbol: 'EOS'}}
    console.warn('1', this.label, D.copy(this.tokens))
    let newAccountInfo = await this._network.getAccountInfo(this.label, this.tokens)
    console.warn('2', newAccountInfo)
    await this._updatePermissions(newAccountInfo.permissions)
    console.warn('3', newAccountInfo)
    delete newAccountInfo.permissions
    this._fromAccountInfo(newAccountInfo)
    await this._coinData.updateAccount(this._toAccountInfo())
    console.warn('4', this._toAccountInfo())

    let txs = await this._network.queryAddress(this.label, this.queryOffset)
    console.warn('5', txs)
    for (let tx of txs) {
      await this._handleNewTx(tx)
    }
  }

  async _updatePermissions (permissions) {
    let updatedAddressInfos = []
    let needCheck = true
    while (needCheck) {
      for (let permission of Object.values(permissions)) {
        for (let pKey of permission.pKeys) {
          let relativeInfo = this.addressInfos.find(a => pKey.publicKey === a.publicKey)
          if (!relativeInfo) {
            console.warn('publicKey not found in class', pKey)
            continue
          }
          if (!relativeInfo.address ||
            !relativeInfo.registered ||
            relativeInfo.type !== permission.name ||
            relativeInfo.parent !== permission.parent ||
            relativeInfo.threshold !== permission.threshold ||
            relativeInfo.weight !== pKey.weight) {
            console.log('update permission info', relativeInfo, pKey)
            relativeInfo.address = this.label
            relativeInfo.registered = true
            relativeInfo.type = permission.name
            relativeInfo.parent = permission.parent
            relativeInfo.threshold = permission.threshold
            relativeInfo.weight = pKey.weight
            updatedAddressInfos.push(relativeInfo)
          }
        }
      }
      needCheck = (await this._checkPermissionAndGenerateNew()).length > 0
    }
    await this._coinData.updateAddressInfos(updatedAddressInfos)
  }

  async _checkPermissionAndGenerateNew () {
    // see slip-0048 recovery
    let permissionPaths = this.addressInfos.map(a => {
      return {
        registered: a.registered,
        path: a.path,
        index: a.index,
        pathIndexes: D.address.path.parseString(a.path)
      }
    })
    let maxRegisteredPermissionIndex = permissionPaths
      .filter(path => path.registered)
      .reduce((max, path) => Math.max(max, path[2]), 0x80000000 - 1)
    maxRegisteredPermissionIndex -= 0x80000000

    let startPermissionIndex = maxRegisteredPermissionIndex + 1
    let newAddressInfos = [] // permission info
    for (let pIndex = startPermissionIndex; pIndex < startPermissionIndex + maxIndexThreshold; pIndex++) {
      let subPath = D.address.path.makeSlip48Path(this.coinType, pIndex, this.index)
      // path that has the same coinType(sure), permission, accountIndex(sure)
      let filteredPermissionPaths = permissionPaths.filter(path =>
        subPath === D.address.path.makeSlip48Path(path.pathIndexes[0], path.pathIndexes[1], path.pathIndexes[2]))
      let maxKeyIndex = filteredPermissionPaths.reduce((max, path) => Math.max(max, path.index), -1)

      let startKeyIndex = maxKeyIndex + 1
      for (let j = startKeyIndex; j < startKeyIndex + maxIndexThreshold; j++) {
        let path = D.address.path.makeSlip48Path(this.coinType, pIndex, this.index, j)
        if (!filteredPermissionPaths.some(p => p.path === path)) {
          let publicKey = await this._device.getPublicKey(this.coinType, path)
          console.debug('generate public key with path', path, publicKey)
          // generate a permissionInfo no matter it use or not for recovery
          newAddressInfos.push({
            address: '',
            accountId: this.accountId,
            coinType: this.coinType,
            path: path,
            type: '',
            index: j,
            registered: false,
            publicKey: publicKey,
            parent: ''
          })
        }
      }
    }

    await this._coinData.newAddressInfos(this._toAccountInfo(), newAddressInfos)
    this.addressInfos.push(...newAddressInfos)
    return newAddressInfos
  }

  async _handleRemovedTx (removedTxId) {
    let txInfo = this.txInfos.find(txInfo => txInfo.txId === removedTxId)
    await this._coinData.removeTx(this._toAccountInfo(), this.addressInfos, txInfo)
  }

  async _handleNewTx (txInfo) {
    await this._coinData.newTx(this._toAccountInfo(), this.addressInfos, txInfo)
  }

  /**
   * Returns whether this EOS account is registered.
   */
  isRegistered () {
    return this.permissions && this.permissions.length > 0
  }

  /**
   * Return all permissions or {owner, active} from device(important) if not registered
   * @returns {Promise<*>}
   */
  async getPermissions () {
    if (this.permissions) {
      let permissions = D.copy(this.permissions)
      permissions.registered = true
      return permissions
    }

    return {
      registered: false,
      'owner': {
        name: 'owner',
        parent: '',
        threshold: 1,
        keys: [{
          publicKey: this._device.getPublicKey(this.coinType, "m/48'/4'/0'/0'/0'"), // slip-0048
          weight: 1,
          path: "m/48'/4'/0'/0'/0'"
        }]
      },
      'active': {
        name: 'active',
        parent: 'owner',
        threshold: 1,
        keys: [{
          publicKey: this._device.getPublicKey(this.coinType, "m/48'/4'/1'/0'/0'"), // slip-0048
          weight: 1,
          path: "m/48'/4'/1'/0'/0'"
        }]
      }
    }
  }

  async getAddress () {
    console.warn('eos don\'t support get address')
    throw D.error.notImplemented
  }

  async rename () {
    console.warn('eos don\'t support change account name')
    throw D.error.notImplemented
  }

  async prepareTx (details) {
    if (!details.token || !details.type) {
      console.warn('no require fields', details)
      throw D.error.invalidParams
    }

    switch (details.type) {
      case txType.tokenTransfer:
        return this._prepareTransfer(details)
      default:
        console.warn('unsupported transaction type', details.type)
        throw D.error.notImplemented
    }
  }

  /**
   * token transfer based on eosio.token API
   *
   * @param details
   * {
   *   type: string,
   *   token: string,
   *   outputs: [{
   *     account: string,
   *     value: decimal string / number
   *   }],
   *   sendAll: bool (optional),
   *   account: string (optional), // contract name
   *   precision: decimal string / number (optional),
   *   expirationAfter: decimal string / number (optional),
   *   maxNetUsageWords: decimal integer string / number (optional),
   *   maxCpuUsageMs: decimal integer string / number (optional),
   *   delaySec: decimal integer string / number (optional),
   *   refBlockNum: decimal integer string / number (optional),
   *   refBlockPrefix: decimal integer string / number (optional),
   *   comment: string (optional),
   * }
   * @returns {Promise<{}>}
   * {
   *   type: string,
   *   sendAll: bool,
   *   token: string,
   *   outputs: [{
   *     account: string,
   *     value: decimal string
   *   }],
   *   actions: [{...}, ...],
   *   expirationAfter: decimal string / number (optional),
   *   expiration: decimal string / number (optional), // ignore if expirationAfter exists
   *   maxNetUsageWords: decimal integer string / number (optional),
   *   maxCpuUsageMs: decimal integer string / number (optional),
   *   delaySec: decimal integer string / number (optional),
   *   refBlockNum: decimal integer string / number (optional),
   *   refBlockPrefix: decimal integer string / number (optional),
   *   comment: string (optional),
   * }
   */
  async _prepareTransfer (details) {
    const defaultExpirationAfter = 10 * 60 // seconds

    let token = tokenList[details.token]
    details.account = details.account || token.account
    if (!details.account || typeof details.account !== 'string' || details.account.length > 12) {
      console.warn('invalid account', details)
      throw D.error.invalidParams
    }
    let tokenPrecision = details.precision || token.precision

    if (!details.outputs) {
      details.outputs = []
    }
    if (!details.outputs[0]) {
      details.outputs[0] = {address: '', value: 0}
    }

    if (details.token.length > 7) { // eosjs format.js
      console.warn('Asset symbol is 7 characters or less', details)
      throw D.error.invalidParams
    }

    for (let output of details.outputs) {
      if (!output.account || !output.value || Number(output.value) < 0) {
        console.warn('invalid value', output)
        throw D.error.invalidParams
      }

      if (typeof output.value !== 'string') {
        output.value = new BigDecimal(output.value).toPlainString()
      }
      let parts = output.value.split('.')
      let precision = (parts[1] && parts[1].length) || 0
      if (precision > 18) { // eosjs format.js
        console.warn('Precision should be 18 characters or less', details)
        throw D.error.invalidParams
      } else if (precision > tokenPrecision) {
        console.warn('precision bigger than token specific precision', details, tokenPrecision)
        throw D.error.invalidParams
      } else {
        if (parts[1] === undefined) output.value += '.'
        output.value += '0'.repeat(tokenPrecision - precision)
      }
    }

    if (details.sendAll) {
      for (let output of details.outputs) {
        // noinspection JSValidateTypes
        output.value = '0'
      }
      details.outputs[0] = this.balance
    }

    let prepareTx = {}
    if (details.expirationAfter) {
      prepareTx.expirationAfter = Number(details.expirationAfter)
    } else if (details.expiration) {
      prepareTx.expiration = Number(details.expiration)
    } else {
      prepareTx.expirationAfter = defaultExpirationAfter
    }

    if (details.maxNetUsageWords) {
      prepareTx.maxNetUsageWords = Number(details.maxNetUsageWords)
    }
    if (details.maxCpuUsageMs) {
      prepareTx.maxCpuUsageMs = Number(details.maxCpuUsageMs)
    }
    if (details.delaySec) {
      prepareTx.delaySec = Number(details.delaySec)
    }
    if (details.refBlockNum) {
      prepareTx.refBlockNum = Number(details.refBlockNum)
    }
    if (details.refBlockPrefix) {
      prepareTx.refBlockPrefix = Number(details.refBlockPrefix)
    }
    prepareTx.comment = details.comment || ''

    let makeTransferAction = (from, to, value, account, token, permission, comment) => {
      return {
        account: account,
        name: 'transfer',
        authorization: [
          {
            actor: from,
            permission: permission
          }
        ],
        data: {
          from: from,
          to: to,
          quantity: value + ' ' + token,
          memo: comment || ''
        }
      }
    }

    // TODO later, configurable permission
    prepareTx.actions = details.outputs.map(output =>
      makeTransferAction(this.label, output.account, output.value, details.account, details.token, 'active', details.comment))

    return prepareTx
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    if (!prepareTx.refBlockNum || !prepareTx.refBlockPrefix) {
      let blockInfo = await this._network.getIrreversibleBlockInfo()
      prepareTx.refBlockNum = prepareTx.refBlockNum || blockInfo.ref_block_num
      prepareTx.refBlockPrefix = prepareTx.refBlockPrefix || blockInfo.ref_block_prefix
    }

    let expiration = prepareTx.expirationAfter
      ? Math.floor(new Date().getTime() / 1000) + prepareTx.expirationAfter
      : prepareTx.expiration
    let presignTx = {
      expiration: expiration,
      ref_block_num: prepareTx.refBlockNum,
      ref_block_prefix: prepareTx.refBlockPrefix,
      max_net_usage_words: prepareTx.maxNetUsageWords || 0,
      max_cpu_usage_ms: prepareTx.maxNetUsageWords || 0,
      delay_sec: prepareTx.delaySec || 0,
      context_free_actions: [],
      actions: prepareTx.actions,
      transaction_extensions: []
    }

    presignTx.keyPaths = []
    for (let action of presignTx.actions) {
      for (let auth of action.authorization) {
        let permission = this.permissions[auth.permission]
        if (!permission) {
          console.warn('key path of relative permission not found', action)
          throw D.error.permissionNotFound
        }
        permission.forEach(p => {
          if (!presignTx.keyPaths.includes(p.keyPath)) {
            presignTx.keyPaths.push(p.keyPath)
          }
        })
      }
    }
    console.log('presign tx', presignTx)
    let {txId, signedTx} = await this._device.signTransaction(this.coinType, presignTx)
    let txInfo = {
      txId: txId,
      accountId: this.accountId,
      coinType: this.coinType,
      blockNumber: D.tx.confirmation.pending,
      time: new Date().getTime(),
      comment: prepareTx.comment,
      actions: D.copy(prepareTx.actions)
    }

    return {signedTx, txInfo}
  }

  /**
   * broadcast transaction to btcNetwork
   * @param signedTx
   * @param test won't broadcast to ethNetwork if true
   * @see signedTx
   */
  async sendTx (signedTx, test = false) {
    // broadcast transaction to network
    console.log('sendTx', signedTx)
    if (!test) await this._coinData.sendTx(this.coinType, signedTx.signedTx)
    await this._handleNewTx(signedTx.txInfo)
  }
}
