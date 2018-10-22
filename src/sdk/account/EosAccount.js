
import D from '../D'
import IAccount from './IAccount'
import {BigDecimal} from 'bigdecimal'

const tokenList = {
  'EOS': 'eosio.token',
  'SYS': 'eosio.token',
  'JUNGLE': 'eosio.token'}

export default class EosAccount extends IAccount {
  async _handleRemovedTx (removedTxId) {
  }

  async _handleNewTx (txInfo) {
  }

  async getAddress (isStoring = false) {
    console.warn('eos don\'t support get address')
    throw D.error.unknown
  }

  async rename () {
    console.warn('eos don\'t support change account name')
    throw D.error.unknown
  }

  /**
   *
   * @param details
   * {
   *   sendAll: bool,
   *   token: string,
   *   outputs: [{
   *     account: string,
   *     value: decimal string / number
   *   }],
   *   expirationAfter: decimal string / number (optional),
   *   maxNetUsageWords: decimal integer string / number (optional),
   *   maxCpuUsageMs: decimal integer string / number (optional),
   *   delaySec: decimal integer string / number (optional),
   *   refBlockNum: decimal integer string / number (optional),
   *   refBlockPrefix: decimal integer string / number (optional),
   *   comment: string (optional),
   * }
   * @returns {Promise<{}>}
   */
  async prepareTx (details) {
    const defaultExpirationAfter = 10 * 60 // seconds

    if (!details.token) {
      console.warn('no require fields', details)
      throw D.error.invalidParams
    }

    let account = tokenList[details.token]
    if (!account) {
      console.warn('unsupported token', details.token)
      throw D.error.coinNotSupported
    }
    details.account = account

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
      if (!output.account || output.account.length > 12) {
        console.warn('invalid account name', output)
        throw D.error.invalidParams
      }
      if (Number(output.value) < 0) {
        console.warn('invalid value', output)
        throw D.error.invalidParams
      }

      if (typeof output.value !== 'string') {
        output.value = new BigDecimal(output.value).toPlainString()
      }
      let precision = output.value.split('.')[1].length
      if (precision > 18) { // eosjs format.js
        console.warn('Precision should be 18 characters or less', details)
        throw D.error.invalidParams
      }
    }

    if (details.sendAll) {
      for (let output of details.outputs) {
        // noinspection JSValidateTypes
        output.value = '0'
      }
      details.outputs[0] = this.balance
    }

    details.expirationAfter = details.expirationAfter || defaultExpirationAfter
    if (details.expirationAfter) {
      details.expirationAfter = Number(details.expirationAfter)
    }
    if (details.maxNetUsageWords) {
      details.maxNetUsageWords = Number(details.maxNetUsageWords)
    }
    if (details.maxCpuUsageMs) {
      details.maxCpuUsageMs = Number(details.maxCpuUsageMs)
    }
    if (details.delaySec) {
      details.delaySec = Number(details.delaySec)
    }
    if (details.refBlockNum) {
      details.refBlockNum = Number(details.refBlockNum)
    }
    if (details.refBlockPrefix) {
      details.refBlockPrefix = Number(details.refBlockPrefix)
    }

    return details
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
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
    let actions = prepareTx.outputs.forEach(output =>
      makeTransferAction(this.label, output.address, output.value, prepareTx.account, prepareTx.token, 'active', prepareTx.comment))

    if (!prepareTx.refBlockNum || !prepareTx.refBlockPrefix) {
      let blockInfo = await this._coinData.getEosBlockInfo()
      prepareTx.refBlockNum = prepareTx.refBlockNum || blockInfo.ref_block_num
      prepareTx.refBlockPrefix = prepareTx.refBlockPrefix || blockInfo.ref_block_prefix
    }

    let presignTx = {
      expiration: Math.floor(new Date().getTime() / 1000) + prepareTx.expirationAfter,
      ref_block_num: prepareTx.refBlockNum,
      ref_block_prefix: prepareTx.refBlockPrefix,
      max_net_usage_words: prepareTx.maxNetUsageWords || 0,
      max_cpu_usage_ms: prepareTx.maxNetUsageWords || 0,
      delay_sec: prepareTx.delaySec || 0,
      context_free_actions: [],
      actions: actions,
      transaction_extensions: []
    }

    console.log('presign tx', presignTx)
    let signatures = await this._device.sign(this.coinType, presignTx)
    let txInfo = {}
    let signedTx = D.copy(presignTx)
    signedTx.signatures = signatures

    return {signedTx, txInfo}
  }

  /**
   * broadcast transaction to btcNetwork
   * @param signedTx
   * @param test won't broadcast to ethNetwork if true
   * @see signedTx
   */
  async sendTx (signedTx, test = false) {
    throw D.error.notImplemented
  }
}
