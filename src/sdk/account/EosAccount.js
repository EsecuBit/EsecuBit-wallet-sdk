
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

export default class EosAccount extends IAccount {
  constructor (info, device, coinData) {
    super(info, device, coinData)
    this._network = this._network.getNetwork(this.coinType)
  }

  async sync (firstSync = false, offlineMode = false) {
    if (!this.label) {
      console.log('EosAccount not registered, check owner publickeys')
      // TODO
    }

    let newAccountInfo = await this._network.getAccountInfo(this.label, D.copy(this.tokens))
    this._fromAccountInfo(newAccountInfo)
    await this._coinData.updateAccount(this._toAccountInfo())

    let txs = await this._network.queryAddress(this.label, this.queryOffset)
    for (let tx of txs) {
      await this._handleNewTx(tx)
    }
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

  async getPermissions () {
    // TODO return all permissions or {owner, active} from device(important) if not registered
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
