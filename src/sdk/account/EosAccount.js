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

// according to slip48, index threshold and permission threshold = 5.
// but it's too waste time, so we only check first owner key and first active key
const maxIndexThreshold = 1
const maxPermissionThreshold = 2
const importHeader = 'import_'

function isImportKey (address) {
  return address.path.startsWith(importHeader)
}

export default class EosAccount extends IAccount {
  constructor (info, device, coinData) {
    super(info, device, coinData)
    this._network = this._coinData.getNetwork(this.coinType)
    if (!this._network) {
      console.warn('EosAccount CoinData not support this network', this.coinType)
      throw D.error.invalidParams
    }
  }

  _fromAccountInfo (info) {
    super._fromAccountInfo(info)

    this.queryOffset = info.queryOffset
    this.tokens = D.copy(info.tokens)
    this.resources = D.copy(info.resources)
  }

  _toAccountInfo () {
    let info = super._toAccountInfo()
    info.queryOffset = this.queryOffset
    info.tokens = D.copy(this.tokens)
    info.resources = D.copy(this.resources)
    return info
  }

  async sync (callback, firstSync = false, offlineMode = false) {
    if (!this.isRegistered()) {
      console.warn('this EosAccount has not been registered, exit')
      return
    }

    if (!offlineMode) {
      await this._checkPermissionAndGenerateNew()
    }

    this.tokens = this.tokens || {'EOS': {code: 'eosio.token', symbol: 'EOS'}}
    let newAccountInfo = await this._network.getAccountInfo(this.label, this.tokens)
    console.info('EosAccount sync getAccountInfo', newAccountInfo)
    this._syncPermissions = newAccountInfo.permissions
    this.tokens = D.copy(newAccountInfo.tokens)
    this.resources = D.copy(newAccountInfo.resources)
    this.balance = newAccountInfo.balance

    await this._coinData.updateAccount(this._toAccountInfo())

    let txs = await this._network.queryAddress(this.label, this.queryOffset)
    this.queryOffset = this._network.getNextActionSeq(this.label)
    txs = txs.filter(tx => !this.txInfos.some(t => t.txId === tx.txId))
    for (let tx of txs) {
      tx.accountId = this.accountId
      tx.coinType = this.coinType
      tx.comment = ''
      await this._handleNewTx(tx)
    }
  }

  async _checkAccountImportedKey () {
    if (this.isRegistered()) {
      console.log('account is registered, skip _checkAccountImportedKey')
      return false
    }

    if (this.index !== 0) {
      console.log('not the first account, skip', this.index)
      return false
    }

    let response = await this._device.getPermissions(this.coinType, this.index)
    console.log('_checkAccountImportedKey getPermissions', response)
    let pmInfos = []
    for (let pmInfo of response) {
      this.label = pmInfo.actor
      if (pmInfo.type === 0) {
        let path = pmInfo.data
        let publicKey = await this._device.getAddress(this.coinType, path)
        pmInfos.push({
          address: pmInfo.name,
          accountId: this.accountId,
          coinType: this.coinType,
          path: path,
          type: pmInfo.name,
          index: D.address.path.toArray(path)[4] - 0x80000000,
          registered: false,
          publicKey: publicKey,
          parent: '',
          txs: []
        })
      } else if (pmInfo.type === 1) {
        let publicKey = pmInfo.data
        pmInfos.push({
          address: pmInfo.name,
          accountId: this.accountId,
          coinType: this.coinType,
          path: importHeader + pmInfo.name + '_' + publicKey,
          type: pmInfo.name,
          index: -1,
          registered: false,
          publicKey: publicKey,
          parent: '',
          txs: []
        })
      }
    }

    if (pmInfos.length > 0) {
      await this._coinData.newAddressInfos(this._toAccountInfo(), pmInfos)
      this.addressInfos.push(...pmInfos)
    }
    return pmInfos.length > 0
  }

  /**
   * Check new permissions for slip48 generated public keys. Needs device interaction
   *
   * @param callback callback(error, status, permissions) when new permission found.
   * status = D.status.syncingNewEosPermissions or D.status.syncingNewEosWillConfirmPermissions
   * @returns {Promise<boolean>}
   */
  async checkAccountPermissions (callback) {
    try {
      if (!(await this._checkAccountImportedKey())) {
        if (this.type === 0) {
          await this._checkPermissionAndGenerateNew()
        } else {
          await this._checkPermissionAndRecover()
        }
      }
    } catch (e) {
      console.warn('checkNewPermission check error', e)
      console.warn('app may in offline mode, ignore here')
    }

    let checkNewAccount = async () => {
      let checkAddressInfos = D.copy(this.addressInfos)
      // let hasImportKeys = checkAddressInfos.some(a => isImportKey(a))
      // if (hasImportKeys) {
      //   checkAddressInfos = checkAddressInfos.filter(a => isImportKey(a))
      // }
      for (let pmInfo of checkAddressInfos) {
        console.log('EosAccount not registered, check publickey', pmInfo.path, pmInfo.publicKey)
        // slip-0048 recovery
        let accounts = await this._network.getAccountByPubKey(pmInfo.publicKey)
        if (!accounts || accounts.length === 0) {
          console.info('EosAccount specific path not registered', pmInfo.path, pmInfo.publicKey)
        } else {
          // choose the first account if this key matches multi accounts
          return accounts[0]
        }
        // slow down the request speed
        await D.wait(200)
      }
      console.info('this EosAccount has not been registered')
      return null
    }

    let accountName = this.label
    if (!this.isRegistered()) {
      accountName = await checkNewAccount()
    }
    if (!accountName) {
      return false
    }
    this.label = accountName

    let tokens = this.tokens || {'EOS': {code: 'eosio.token', symbol: 'EOS'}}
    let syncPermissions = this._syncPermissions
    if (!syncPermissions) {
      let newAccountInfo = await this._network.getAccountInfo(accountName, tokens)
      console.info('EosAccount registered getAccountInfo', newAccountInfo)
      syncPermissions = newAccountInfo.permissions
    }
    this._syncPermissions = null
    let updatedPermissions = await this._updatePermissions(syncPermissions, callback)

    return updatedPermissions.length > 0
  }

  async _updatePermissions (permissions, updateCallback) {
    let updatePmInfos = []
    let addDevicePmInfos = []
    let removeDevicePmInfos = []
    let needCheck = true
    while (needCheck) {
      for (let permission of Object.values(permissions)) {
        for (let pKey of permission.pKeys) {
          let pmInfo = this.addressInfos.find(a => pKey.publicKey === a.publicKey)
          if (!pmInfo) {
            console.warn('publicKey not found in account', pKey)
            continue
          }

          pmInfo = D.copy(pmInfo)
          if (!pmInfo.address ||
            !pmInfo.registered ||
            pmInfo.type !== permission.name ||
            pmInfo.parent !== permission.parent ||
            pmInfo.threshold !== permission.threshold ||
            pmInfo.weight !== pKey.weight) {
            // check permissions that needs update to device
            if (!pmInfo.address ||
              !pmInfo.registered ||
              pmInfo.type !== permission.name) {
              // TODO handle permission that only change path or name, first remove then add
              if (!isImportKey(pmInfo)) {
                // imported key no need to add
                addDevicePmInfos.push(pmInfo)
              }
            }

            console.log('update permission info', pmInfo, permission)
            pmInfo.address = this.label
            pmInfo.registered = true
            pmInfo.type = permission.name
            pmInfo.parent = permission.parent
            pmInfo.threshold = permission.threshold
            pmInfo.weight = pKey.weight
            updatePmInfos.push(pmInfo)
          }
        }

        let existsPmInfos = this.addressInfos.filter(a => a.registered)
        let allPKeys = Object.values(permissions).reduce((sum, p) => sum.concat(p.pKeys), [])
        for (let pmInfo of existsPmInfos) {
          let relativePKeys = allPKeys.find(p => p.publicKey === pmInfo.publicKey)
          if (!relativePKeys) {
            // this permission was deleted
            console.log('remove permission info', permission)

            pmInfo = D.copy(pmInfo)
            pmInfo.registered = false
            updatePmInfos.push(pmInfo)
            removeDevicePmInfos.push(pmInfo)
          }
        }
      }

      needCheck = (await this._checkPermissionAndGenerateNew()).length > 0
    }

    if (updatePmInfos.length === 0) {
      console.info('permissions not change')
      return []
    }

    if (typeof updateCallback !== 'function') {
      console.warn('updateCallback not a function')
      throw D.error.invalidParams
    }
    console.info('permissions needs update', updatePmInfos, addDevicePmInfos, removeDevicePmInfos)
    D.dispatch(() => updateCallback(D.error.succeed,
      D.status.newEosPermissions,
      {
        all: D.copy(updatePmInfos),
        removeFromDevice: D.copy(removeDevicePmInfos),
        addToDevice: D.copy(addDevicePmInfos)
      }))

    for (let pmInfo of D.copy(removeDevicePmInfos)) {
      let error = D.error.succeed
      try {
        await this._device.removePermission(this.coinType, pmInfo)
        D.dispatch(() => updateCallback(error,
          D.status.confirmedEosPermission, D.copy(pmInfo)))
      } catch (e) {
        if (e === D.error.deviceConditionNotSatisfied) {
          console.warn('remove permission not exists, ignore')
          error = D.error.permissionNoNeedToConfirmed
        } else if (e === D.error.userCancel) {
          console.warn('cancel in removePermission', D.copy(pmInfo))
          removeDevicePmInfos = removeDevicePmInfos.filter(p => p.path !== pmInfo.path)
          updatePmInfos = updatePmInfos.filter(p => p.path !== pmInfo.path)
          D.dispatch(() => updateCallback(error,
            D.status.canceledEosPermission, D.copy(pmInfo)))
        } else {
          throw e
        }
      }
    }
    for (let pmInfo of D.copy(addDevicePmInfos)) {
      let error = D.error.succeed
      try {
        await this._device.addPermission(this.coinType, pmInfo)
        D.dispatch(() => updateCallback(error,
          D.status.confirmedEosPermission, D.copy(pmInfo)))
      } catch (e) {
        if (e === D.error.deviceConditionNotSatisfied) {
          console.warn('add permission not exists, ignore')
          error = D.error.permissionNoNeedToConfirmed
        } else if (e === D.error.userCancel) {
          console.warn('cancel in addPermission', D.copy(pmInfo))
          addDevicePmInfos = addDevicePmInfos.filter(p => p.path !== pmInfo.path)
          updatePmInfos = updatePmInfos.filter(p => p.path !== pmInfo.path)
          D.dispatch(() => updateCallback(error,
            D.status.canceledEosPermission, D.copy(pmInfo)))
        } else {
          throw e
        }
      }
    }

    console.log('final updatePmInfos', JSON.stringify(updatePmInfos))
    await this._coinData.updateAddressInfos(updatePmInfos)
    // update addressInfo
    this.addressInfos = this.addressInfos.map(a => {
      let pmInfo = updatePmInfos.find(u => u.path === a.path)
      return pmInfo || a
    })

    return D.copy(updatePmInfos)
  }

  async _checkPermissionAndRecover () {
    try {
      let newAddressInfos = []
      let response = await this._device.getPermissions(this.coinType, 0)
      let permissionArray = D.copy(response)
      let permissionLength = permissionArray.length
      let hash = {}
      response = response.reduce((item, next) => {
        hash[next.actor] ? '' : hash[next.actor] = true && item.push(next)
        return item
      }, [])
      let accountLength = response.length
      let accountArray = new Array(accountLength)
      let index = 0
      for (let i = 0; i < accountLength; i++) {
        accountArray[i] = new Array(0)
        for (let j = index; j < permissionLength; j++) {
          if (accountArray[i].length === 0) {
            accountArray[i].push(permissionArray[j])
            ++index
          } else {
            let account = accountArray[i]
            let prevPermission = account[j - 1]
            if (prevPermission && prevPermission.actor === permissionArray[j].actor && prevPermission.name !== permissionArray[j].name) {
              accountArray[i].push(permissionArray[j])
              ++index
            }
          }
        }
      }
      let permissions = accountArray[this.index]
      permissions && permissions.map((it, index) => {
        let addressInfoIndex = index
        if (index !== 0) {
          ++addressInfoIndex
        }
        let publicKey = it.data
        newAddressInfos.push({
          address: '',
          accountId: this.accountId,
          coinType: this.coinType,
          path: importHeader + it.name + '_' + publicKey,
          type: '',
          index: addressInfoIndex,
          registered: false,
          publicKey: it.data,
          parent: '',
          txs: [] // rfu
        })
      })
      await this._coinData.updateAddressInfos(newAddressInfos)
      this.addressInfos.push(...newAddressInfos)
      return newAddressInfos
    } catch (e) {
      if (e === D.error.deviceConditionNotSatisfied) {
        console.warn('device has no wallet, ignore')
        return []
      } else {
        throw e
      }
    }
  }

  async _checkPermissionAndGenerateNew () {
    while (this._busy) {
      await D.wait(10)
    }
    this._busy = true

    try {
      // see slip-0048 recovery
      let permissionPaths = this.addressInfos
        .filter(a => !isImportKey(a))
        .map(a => {
          return {
            registered: a.registered,
            path: a.path,
            index: a.index,
            pathIndexes: D.address.path.toArray(a.path)
          }
        })
      let maxRegPermissionIndex = permissionPaths
        .filter(path => path.registered)
        .reduce((max, path) => Math.max(max, path.pathIndexes[2]), 0x80000000 - 1)
      maxRegPermissionIndex -= 0x80000000

      let endPermissionIndex = maxRegPermissionIndex + 1
      let newAddressInfos = [] // permission info

      for (let pmIndex = 0; pmIndex < endPermissionIndex + maxPermissionThreshold; pmIndex++) {
        let subPath = D.address.path.makeSlip48Path(this.coinType, pmIndex, this.index)
        // filter paths that has the same coinType, permission, accountIndex
        let filteredPermissionPaths = permissionPaths.filter(path =>
          subPath === D.address.path.makeSlip48Path(
            path.pathIndexes[1] - 0x80000000,
            path.pathIndexes[2] - 0x80000000,
            path.pathIndexes[3] - 0x80000000))

        let maxKeyIndex = filteredPermissionPaths.reduce((max, path) => Math.max(max, path.index), -1)
        let maxRegisteredKeyIndex = filteredPermissionPaths
          .filter(path => path.registered)
          .reduce((max, path) => Math.max(max, path.index), -1)

        let startKeyIndex = maxKeyIndex + 1
        let startRegKeyIndex = maxRegisteredKeyIndex + 1
        for (let j = startKeyIndex; j < startRegKeyIndex + maxIndexThreshold; j++) {
          let path = D.address.path.makeSlip48Path(this.coinType, pmIndex, this.index, j)
          if (!filteredPermissionPaths.some(p => p.path === path)) {
            let publicKey = await this._device.getAddress(this.coinType, path)
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
              parent: '',
              txs: [] // rfu
            })
          }
        }
        //
      }

      await this._coinData.updateAddressInfos(newAddressInfos)
      this.addressInfos.push(...newAddressInfos)
      return newAddressInfos
    } catch (e) {
      if (e === D.error.deviceConditionNotSatisfied) {
        console.warn('device has no wallet, ignore')
        return []
      } else {
        this._busy = false
        throw e
      }
    } finally {
      this._busy = false
    }
  }

  async _handleRemovedTx (removedTxId) {
    let txInfo = this.txInfos.find(txInfo => txInfo.txId === removedTxId)
    await this._coinData.removeTx(this._toAccountInfo(), [], txInfo)
    this.txInfos = this.txInfos.filter(t => t !== txInfo)
  }

  async _handleNewTx (txInfo) {
    await this._coinData.newTx(this._toAccountInfo(), [], txInfo)
    this.txInfos.push(txInfo)
  }

  /**
   * Returns whether this EOS account is registered.
   */
  isRegistered () {
    return this.addressInfos.some(a => a.registered)
  }

  async importAccountByKeys (name, ownerKey, activeKey) {
    if (this.isRegistered() && (name !== this.label)) {
      console.warn('currently not support multiple registered account')
      throw D.error.multipleAccounts
    }

    let accountInfo = await this._network.getAccountInfo(name, [])
    let importKey = async (key, auth) => {
      let publicKeyBuffer = D.address.eosPrivateToPublicBuffer(key)
      let publicKey = D.address.toString(this.coinType, publicKeyBuffer)

      console.info('importAccountByKeys accounts', name, accountInfo)
      if (!accountInfo.permissions[auth]) {
        console.warn('owner key not found', publicKey)
        throw D.error.keyNotMatch
      }
      if (!accountInfo.permissions[auth].pKeys.find(p => p.publicKey === publicKey)) {
        console.warn('owner key not found in owner', publicKey)
        throw D.error.keyNotMatch
      }
      // check the key whehter if exist
      let addressInfos = await this._coinData.getAddressInfos({coinType: this.coinType})
      let isKeyExist = addressInfos.filter(it => it.address === name).some(t => {
        if (ownerKey) return t.type === 'owner'
        if (activeKey) return t.type === 'active'
      })
      if (isKeyExist) {
        console.warn(name + 'had imported key')
        throw D.error.deviceConditionNotSatisfied
      }
      try {
        await this._device.importKey(this.coinType, {accountIndex: this.index, address: name, type: auth, key: key})
      } catch (e) {
        throw e
      }

      let keyInfo = {
        address: name,
        accountId: this.accountId,
        coinType: this.coinType,
        path: importHeader + auth + '_' + publicKey,
        type: auth,
        index: -1,
        registered: true,
        publicKey: publicKey,
        parent: '',
        txs: []
      }
      try {
        this.label = name
        await this._coinData.newAddressInfos(this._toAccountInfo(), [keyInfo])
        this.addressInfos.push(keyInfo)
      } catch (e) {
        console.log('database already has this key', e)
      }
    }

    if (ownerKey) {
      await importKey(ownerKey, 'owner')
    }
    if (activeKey) {
      await importKey(activeKey, 'active')
    }
  }

  async removeKey (key) {
    let keyInfo = D.copy(this.addressInfos.find(a => a.publicKey === key))
    if (!keyInfo) {
      console.warn('removeKey not exists', key)
      throw D.error.invalidParams
    }
    try {
      keyInfo.accountIndex = this.index
      await this._device.removeKey(this.coinType, keyInfo)
    } catch (e) {
      if (e === D.error.deviceConditionNotSatisfied) {
        console.log('device already removed this key')
        return false
      }
    }
    await this._coinData.deleteAddressInfos([keyInfo])
    return true
  }

  /**
   * Return all permissions or {owner, active} from device(important) if not registered
   * @returns {Promise<*>}
   */
  async getPermissions (showDefaultOnDevice = false) {
    if (showDefaultOnDevice) {
      await this._device.getDefaultPermissions(this.coinType, this.index)
    }

    if (this.isRegistered()) {
      return D.copy(this.addressInfos.filter(a => a.registered))
    } else {
      await this._checkPermissionAndGenerateNew()
      // return default permissions
      let ownerPmInfo = D.copy(this.addressInfos.find(a => a.path ===
        D.address.path.makeSlip48Path(this.coinType, 0, this.index, 0)))
      let activePmInfo = D.copy(this.addressInfos.find(a => a.path ===
        D.address.path.makeSlip48Path(this.coinType, 1, this.index, 0)))
      if (!ownerPmInfo || !activePmInfo) {
        console.warn('no ownerPmInfo or activePmInfo')
        throw D.error.deviceNotConnected
      }
      ownerPmInfo.type = 'owner'
      activePmInfo.type = 'active'
      return [ownerPmInfo, activePmInfo]
    }
  }

  async getAccountPermission (tokens = {'EOS': {code: 'eosio.token', symbol: 'EOS'}}) {
    let newAccountInfo = await this._network.getAccountInfo(this.label, tokens)
    return newAccountInfo.permissions
  }

  async getAddress (isShowing = false, isStoring = false) {
    if (!this.isRegistered()) {
      console.warn('getAddress account not registered')
    }

    let addressInfo = this.addressInfos.find(a => a.registered)
    let accountName = await this._device.getAccountName(this.coinType, this.index, addressInfo.path, isShowing, isStoring)
    let prefix = ''
    return {address: accountName, qrAddress: prefix + accountName}
  }

  async rename () {
    console.warn('eos don\'t support change account name')
    throw D.error.notImplemented
  }

  /**
   * token transfer based on eosio.token API
   *
   * @param details
   * {
   *   type: string,
   *   expirationAfter: decimal string / number (optional),
   *   expiration: decimal string / number (optional), // ignore if expirationAfter exists
   *   maxNetUsageWords: decimal integer string / number (optional),
   *   maxCpuUsageMs: decimal integer string / number (optional),
   *   delaySec: decimal integer string / number (optional),
   *   refBlockNum: decimal integer string / number (optional),
   *   refBlockPrefix: decimal integer string / number (optional),
   *   comment: string (optional),
   * }
   * @returns {Promise<{}>}
   * {
   *   actions: [{...}, ...],
   *   expirationAfter: decimal string / number (optional),
   *   expiration: decimal string / number (optional), // if expirationAfter not exists and expiration exists
   *   maxNetUsageWords: number,
   *   maxCpuUsageMs: number,
   *   delaySec: number,
   *   refBlockNum: number,
   *   refBlockPrefix: number,
   *   comment: string,
   * }
   */
  async prepareTx (details) {
    details = D.copy(details)
    if (!details.token || !details.type) {
      console.warn('no require fields', details)
      throw D.error.invalidParams
    }

    let handler = {}
    handler[D.coin.params.eos.actionTypes.transfer.type] = this.prepareTransfer
    handler[D.coin.params.eos.actionTypes.issuer.type] = this.prepareIssuer
    handler[D.coin.params.eos.actionTypes.delegate.type] = this.prepareDelegate
    handler[D.coin.params.eos.actionTypes.undelegate.type] = this.prepareDelegate
    handler[D.coin.params.eos.actionTypes.buyram.type] = this.prepareBuyRam
    handler[D.coin.params.eos.actionTypes.buyrambytes.type] = this.prepareBuyRam
    handler[D.coin.params.eos.actionTypes.sellram.type] = this.prepareBuyRam
    handler[D.coin.params.eos.actionTypes.vote.type] = this.prepareVote
    handler[D.coin.params.eos.actionTypes.refund.type] = this.prepareRefund
    handler[D.coin.params.eos.actionTypes.updateauth.type] = this.prepareUpdateAuth
    handler[D.coin.params.eos.actionTypes.other.type] = this.prepareOther

    let method = handler[details.type]
    if (!method) {
      console.warn('unsupported transaction type', details.type)
      throw D.error.notImplemented
    }
    return method.call(this, details)
  }

  /**
   * token transfer based on eosio.token API
   *
   * @param details, common part see prepareTx
   * {
   *   token: string,
   *   outputs: [{
   *     account: string,
   *     value: decimal string / number
   *   }],
   *   sendAll: bool (optional),
   *   account: string (optional), // token contract name
   * }
   * @returns {Promise<{}>} see prepareTx
   */
  async prepareTransfer (details) {
    details = D.copy(details)
    if (!details.token) {
      console.warn('prepareTransfer missing parameter token')
      throw D.error.invalidParams
    }

    details = D.copy(details)
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
      details.outputs[0] = {account: 'unspecified', value: 0}
    }

    if (details.token.length > 7) { // eosjs format.js
      console.warn('Asset symbol is 7 characters or less', details)
      throw D.error.invalidParams
    }

    if (details.sendAll) {
      for (let output of details.outputs) {
        // noinspection JSValidateTypes
        output.value = '0'
      }
      details.outputs[0].value = this.balance
    }

    for (let output of details.outputs) {
      if (!output || !output.account || !output.value === undefined || Number(output.value) < 0) {
        console.warn('prepareTransfer invalid output', output)
        throw D.error.invalidParams
      }
      output.quantity = EosAccount._makeAsset(tokenPrecision, token.name, output.value)
    }

    let actionType = D.coin.params.eos.actionTypes.transfer
    let prepareTx = EosAccount._prepareCommon(details)

    prepareTx.actions = details.outputs.map(output => {
      let action = this._makeBasicAction(details.account, actionType.name, this.label)
      action.data = {
        from: this.label,
        to: output.account,
        quantity: output.quantity,
        memo: details.comment || ''
      }
      return action
    })

    console.log('prepareTransfer', prepareTx)
    return prepareTx
  }

  async prepareIssuer (details) {
    details = D.copy(details)
    console.warn('prepareIssuer not implemented')
    throw D.error.notImplemented
  }

  /**
   * delegate based on eosio.stake API
   *
   * @param details, common part see prepareTx
   * {
   *   delegate: bool, // deletegate or undelegate,
   *   network: decimal string, / number,
   *   cpu: decimal string / number
   *   receiver: string (optional), // delegate for myself if not exists
   *   transfer: boolean (optional) // ignore when undelegate = true
   * }
   * @returns {Promise<{}>} see prepareTx
   */
  async prepareDelegate (details) {
    details = D.copy(details)
    let token = tokenList.EOS
    let prepareTx = EosAccount._prepareCommon(details)
    let network = EosAccount._makeAsset(token.precision, token.name, details.network || 0)
    let cpu = EosAccount._makeAsset(token.precision, token.name, details.cpu || 0)
    let receiver = details.receiver || this.label
    let transfer = details.transfer || false

    let actionType = details.delegate ? D.coin.params.eos.actionTypes.delegate : D.coin.params.eos.actionTypes.undelegate
    let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
    if (details.delegate) {
      action.data = {
        from: this.label,
        receiver: receiver,
        stake_net_quantity: network,
        stake_cpu_quantity: cpu,
        transfer: transfer ? 1 : 0
      }
    } else {
      action.data = {
        from: this.label,
        receiver: receiver,
        unstake_net_quantity: network,
        unstake_cpu_quantity: cpu
      }
    }
    prepareTx.actions = [action]

    console.log('prepareDelegate', prepareTx)
    return prepareTx
  }

  /**
   * buy ram based on eosio API
   *
   * @param details, common part see prepareTx
   * {
   *   buy: bool, // buy or sell
   *   quant: decimal string, / number, // buy ram for how much EOS
   *   ramBytes: decimal string / number // buy how much ram bytes, ignore if quant exists
   *   receiver: string (optional), // buy for myself if not exists, ignore if sell
   *   transfer: boolean (optional) // ignore when undelegate = true
   * }
   * @returns {Promise<{}>} see prepareTx
   */
  async prepareBuyRam (details) {
    details = D.copy(details)
    let prepareTx = EosAccount._prepareCommon(details)

    let receiver = details.receiver || this.label
    if (!details.buy) {
      if (!details.ramBytes) {
        console.warn('no ram quantity provided', details)
        throw D.error.invalidParams
      }
      if (details.ramBytes <= 2) {
        // got "must purchase a positive amount" when ramBytes = 0, 1 or 2
        throw D.error.networkValueTooSmall
      }
      let actionType = D.coin.params.eos.actionTypes.sellram
      let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
      action.data = {
        account: this.label,
        bytes: details.ramBytes
      }
      prepareTx.actions = [action]
    } else {
      if (details.quant) {
        let actionType = D.coin.params.eos.actionTypes.buyram
        let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
        action.data = {
          payer: this.label,
          receiver: receiver,
          quant: EosAccount._makeAsset(tokenList.EOS.precision, tokenList.EOS.name, details.quant)
        }
        prepareTx.actions = [action]
      } else if (details.ramBytes) {
        if (details.ramBytes <= 2) {
          // got "must purchase a positive amount" when ramBytes = 0, 1 or 2
          throw D.error.networkValueTooSmall
        }
        let actionType = D.coin.params.eos.actionTypes.buyrambytes
        let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
        action.data = {
          payer: this.label,
          receiver: receiver,
          bytes: details.ramBytes
        }
        prepareTx.actions = [action]
      } else {
        console.warn('no ram quantity provided', details)
        throw D.error.invalidParams
      }
    }

    console.log('prepareBuyRam', prepareTx)
    return prepareTx
  }

  /**
   * vote based on eosio API
   *
   * @param details, common part see prepareTx
   * {
   *   proxy: string,
   *   producers: string array
   * }
   * @returns {Promise<{}>} see prepareTx
   */
  async prepareVote (details) {
    details = D.copy(details)
    let producers = details.producers || []
    let proxy = details.proxy || ''

    let prepareTx = EosAccount._prepareCommon(details)
    let actionType = D.coin.params.eos.actionTypes.vote
    let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
    action.data = {
      voter: this.label,
      proxy: proxy,
      producers: producers
    }
    prepareTx.actions = [action]

    console.log('prepareVote', prepareTx)
    return prepareTx
  }

  /**
   * refund base on eosio API
   * @param details, common part see prepareTx
   * {
   *   owner: string
   * }
   * @returns {Promise<> see prepareTx}
   */
  async prepareRefund (details) {
    details = D.copy(details)
    let owner = details.owner || ''
    let prepareTx = EosAccount._prepareCommon(details)
    let actionType = D.coin.params.eos.actionTypes.refund
    let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
    action.data = {
      owner: owner
    }
    prepareTx.actions = [action]
    console.info('prepareRefund', prepareTx)
    return prepareTx
  }

  /**
   * updateauth base on eosio API
   * @param details, common part see prepareTx
   * {
   *   accounts: [{
   *      permission: {
   *        actor: string
   *        permission: string
   *      },
   *      weight: number
   *   }],
   *   keys: [{
   *     key: string,
   *     weight: number
   *   }],
   *   threshold: number,
   *   waits: [{
   *     wait_sec: number,
   *     weight: number
   *   }]
   *   parent: string,
   *   permission: string
   * }
   * @returns {Promise<Object> see prepareTx}
   */
  async prepareUpdateAuth (details) {
    details = D.copy(details)
    let permissions = await this.getAccountPermission()
    let permission = details.permission
    let parent = details.parent
    if (!permission || !parent || !permissions) throw D.error.invalidParams
    let auth = permissions[permission].auth
    auth.threshold = details.threshold || 1
    auth.keys = details.keys || []
    auth.accounts = details.accounts || []
    auth.waits = details.waits || []
    let prepareTx = EosAccount._prepareCommon(details)
    let actionType = D.coin.params.eos.actionTypes.updateauth
    let action = this._makeBasicAction(actionType.account, actionType.name, this.label)
    action.data = {
      account: this.label,
      permission: permission,
      parent: parent,
      auth: auth
    }
    prepareTx.actions = [action]
    console.log('prepareUpdateAuth', prepareTx)
    return prepareTx
  }

  /**
   * customize transaction
   *
   * @param details, common part see prepareTx
   * {
   *   account: string, // contract name,
   *   name: string // contract name
   *   data: hex string
   * }
   * @returns {Promise<{}>} see prepareTx
   */
  async prepareOther (details) {
    details = D.copy(details)
    console.warn('prepareDelegate not implemented')
    throw D.error.notImplemented
  }

  static _prepareCommon (details) {
    const defaultExpirationAfter = 10 * 60 // seconds

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
    return prepareTx
  }

  static _makeAsset (tokenPrecision, token, value) {
    if (typeof value !== 'string') {
      value = new BigDecimal(value).toPlainString()
    }
    if (value.includes('.')) {
      let index = value.length - 1
      while (value[index] === '0') index--
      if (value[index] === '.') index--
      value = value.slice(0, index + 1)
    }

    let parts = value.split('.')
    D.validValue(parts[0])
    let precision = (parts[1] && parts[1].length) || 0
    if (precision > 18) { // eosjs format.js
      console.warn('Precision should be 18 characters or less', tokenPrecision, value)
      throw D.error.invalidParams
    } else if (precision > tokenPrecision) {
      console.warn('precision bigger than token specific precision', tokenPrecision, precision, value)
      throw D.error.invalidParams
    } else {
      if (parts[1] === undefined) value += '.'
      value += '0'.repeat(tokenPrecision - precision)
    }
    return value + ' ' + token
  }

  _makeBasicAction (account, name, actor) {
    let pmInfos = this.addressInfos.filter(a => a.address === actor)
    let pmInfo = pmInfos.find(p => p.type === 'active')
    if (!pmInfo) {
      pmInfo = pmInfos.find(p => p.type === 'owner')
      if (!pmInfo) {
        pmInfo = pmInfos.find(p => p.registered)
      }
    }
    if (!pmInfo) {
      console.warn('registered key not found')
      throw D.error.permissionNotFound
    }
    return {
      account: account,
      name: name,
      authorization: [{
        actor: pmInfo.address,
        permission: pmInfo.type
      }]
    }
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    prepareTx = D.copy(prepareTx)
    if (!prepareTx.refBlockNum || !prepareTx.refBlockPrefix) {
      let blockInfo = await this._network.getIrreversibleBlockInfo()
      prepareTx.refBlockNum = prepareTx.refBlockNum || blockInfo.refBlockNum
      prepareTx.refBlockPrefix = prepareTx.refBlockPrefix || blockInfo.refBlockPrefix
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
        // not support multi-sig
        let permissions = this.addressInfos.filter(a => a.type === auth.permission)
        if (permissions.length === 0) {
          console.warn('key path of relative permission not found', action)
          throw D.error.permissionNotFound
        }
        permissions.forEach(p => {
          if (!presignTx.keyPaths.includes(p.path)) {
            presignTx.keyPaths.push(p.path)
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
      confirmations: D.tx.confirmation.waiting,
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
    signedTx = D.copy(signedTx)
    // broadcast transaction to network
    console.log('sendTx', signedTx)
    if (!test) await this._coinData.sendTx(this.coinType, signedTx.signedTx)
    await this._handleNewTx(signedTx.txInfo)
  }

  async getVoteProducers (pageNum = 1, perPage = 50) {
    return this._network.getVoteProducers(pageNum, perPage)
  }

  async getVoteProxies (pageNum = 1, perPage = 50) {
    return this._network.getVoteProxies(pageNum, perPage)
  }

  async getLatestAccountInfo (token = {'EOS': {code: 'eosio.token', symbol: 'EOS'}}) {
    return this._network.getAccountInfo(this.label, token)
  }
}
