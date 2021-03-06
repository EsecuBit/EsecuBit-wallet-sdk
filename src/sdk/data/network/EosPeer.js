import ICoinNetwork from './ICoinNetwork'
import D from '../../D'
import {BigDecimal} from 'bigdecimal'

// jungle
const jungle = {
  // httpEndpoint: 'https://junglehistory.cryptolions.io:4433/', // 502 bad gateway
  httpEndpoint: 'https://api.jungle.alohaeos.com/',
  provider: 'api.jungle.alohaeos.com',
  txUrl: 'https://eospark.com/Jungle/tx/'
}

// TODO configurable
const main = {
  httpEndpoint: 'https://eos.greymass.com/',
  // httpEndpoint: 'https://public.eosinfra.io/',
  // httpEndpoint: 'https://geo.eosasia.one/',
  // httpEndpoint: 'https://api.eostribe.io/',
  provider: 'geo.eosasia.one',
  txUrl: 'https://eospark.com/Main/tx/'
}

export default class EosPeer extends ICoinNetwork {
  async init () {
    this._maxActionSeq = {}

    switch (this.coinType) {
      case D.coin.main.eos:
        this.provider = main.provider
        this._apiUrl = main.httpEndpoint
        this._txUrl = main.txUrl
        break
      case D.coin.test.eosJungle:
        this.provider = jungle.provider
        this._apiUrl = jungle.httpEndpoint
        this._txUrl = jungle.txUrl
        break
      default:
        console.warn('EosPeer don\'t support this coinType yet', this.coinType)
        throw D.error.coinNotSupported
    }
    if (!this._apiUrl) throw D.error.coinNotSupported
    return super.init()
  }

  async post (url, args) {
    let response
    try {
      response = await super.post(url, args)
      return response
    } catch (e) {
      console.warn('EosPeer post error', e.response)
      this.handleErrorCode(e.response)
    }
  }

  handleErrorCode (response) {
    if (!response) throw D.error.networkUnavailable
    let errors = response.data.error
    // api server error
    if (!errors) throw D.error.networkProviderError
    switch (response.data.error.code) {
      case 3040005:
        throw D.error.networkEosTxExpired
      case 3090003:
        throw D.error.networkEosUnsatisfiedAuth
      case 3050003:
        let message = errors.details && errors.details[0].message
        this.throwAssertMsgErrCode(message)
        break
      case 3080001:
        throw D.error.ramNotEnough
      case 3080002:
        throw D.error.networkNotEnough
      case 3080003:
        throw D.error.networkOveruse
      case 3080004:
        throw D.error.cpuNotEnough
      case 3080005:
        throw D.error.cpuOveruse
      default:
        throw D.error.networkProviderError
    }
  }

  throwAssertMsgErrCode (message) {
    if (!message) return
    if (message.indexOf('refund is not available yet') !== -1) throw D.error.refundRequestNotFound
    else if (message.indexOf('to account does not exist') !== -1) throw D.error.accountNotExist
    else throw D.error.networkProviderError
  }

  getTxLink(txInfo) {
    return this._txUrl + txInfo.txId
  }

  getBlockInfo () {
    let url = this._apiUrl + 'v1/chain/get_info'
    return this.get(url).catch(e => {
      if (e.request.status === 0) throw D.error.networkUnavailable
      else throw D.error.networkProviderError
    })
  }

  /**
   * get the irreversible block height
   * @returns {Promise<*>}
   */
  async getBlockHeight() {
    let response = await this.getIrreversibleBlockInfo()
    return response.lastIrreversibleBlockNum
  }

  async getRealBlockHeight() {
    let response = await this.getBlockInfo()
    return response.head_block_num
  }

  async queryAddress(address, offset = 0) {
    let actions = await this.queryActions(address, offset)

    let txs = []
    for (let rAction of actions) {
      let tx = this._wrapActionToTx(rAction)
      let oldTx = txs.find(t => t.txId === tx.txId)
      if (oldTx) {
        oldTx.actions.push(...tx.actions)
      } else {
        txs.push(tx)
        // cache the max account_action_seq to reduce query next time
        // it's not a good way to give account the account_action_seq, but for now we don't have a better way
        this._maxActionSeq[address] = Math.max(this._maxActionSeq[address], rAction.account_action_seq)
      }
    }
    return txs
  }

  async queryActions(accountName, offset = 0) {
    if (D.test.coin) {
      // TODO testnet has different data structor
      return []
    }

    const url = this._apiUrl + 'v1/history/get_actions'
    const defaultPageSize = 100

    let actions = []
    let currentOffset = offset
    this._maxActionSeq[accountName] = offset
    while (true) {
      const args = JSON.stringify({pos: currentOffset, offset: defaultPageSize, account_name: accountName})
      let response = await this.post(url, args)

      let actionsSize = response.actions.length
      // filter actions that don't care
      response.actions = response.actions.filter(action =>
        action.action_trace.act.authorization.actor === accountName ||
        Object.values(action.action_trace.act.data).includes(accountName))

      // // filter actions that it's the same
      response.actions = response.actions.reduce((actions, action) => {
        if (!actions.some(a =>
          a.action_trace.receipt.act_digest === action.action_trace.receipt.act_digest)) {
          actions.push(action)
        }
        return actions
      }, [])

      // filter actions that is inline actions
      // let inlineActions = []
      // response.actions.forEach(action => {
      //   action.action_trace.inline_traces.forEach(inline => {
      //     if (!inlineActions.some(a =>
      //       a.receipt.global_sequence === inline.receipt.global_sequence)) {
      //       inlineActions.push(inline)
      //     }
      //   })
      // })
      // response.actions = response.actions.reduce((actions, action) => {
      //   if (!inlineActions.some(a =>
      //     a.receipt.global_sequence === action.action_trace.receipt.global_sequence)) {
      //     actions.push(action)
      //   }
      //   return actions
      // }, [])

      actions.push(...response.actions)
      currentOffset += response.actions.length

      // caution: some nodes didn't return enough actions sometimes, like http://api.hkeos.com:80.
      // You may get [0, 5) even you query [0, 100), I don't known whether it's a common issue yet.
      if (actionsSize < defaultPageSize) {
        break
      }
    }
    return actions
  }

  getNextActionSeq(address) {
    if (this._maxActionSeq[address]) {
      return this._maxActionSeq[address] + 1
    }
    return 0
  }

  async queryTx(txId) {
    const url = this._apiUrl + 'v1/history/get_transaction'
    const args = JSON.stringify({id: txId})
    let response = await this.post(url, args)
    return this._wrapTx(response)
  }

  async sendTx(rawTransaction) {
    const url = this._apiUrl + 'v1/chain/push_transaction'
    const args = JSON.stringify(rawTransaction)
    await this.post(url, args)
  }

  _wrapTx(rTx) {
    return {
      txId: rTx.id,
      blockNumber: rTx.block_num,
      confirmations: this._blockHeight > rTx.block_num
        ? D.tx.confirmation.executed
        : D.tx.confirmation.waiting, // see D.tx.confirmation
      time: EosPeer._getTimeStamp(rTx.block_time),
      actions: rTx.trx.trx.actions
    }
  }

  _wrapActionToTx(rAction) {
    return {
      txId: rAction.action_trace.trx_id,
      blockNumber: rAction.block_num,
      confirmations: this._blockHeight > rAction.block_num
        ? D.tx.confirmation.executed
        : D.tx.confirmation.waiting, // see D.tx.confirmation
      time: EosPeer._getTimeStamp(rAction.block_time),
      actions: [rAction.action_trace.act]
    }
  }

  static _getTimeStamp(dateString) {
    let localDate = new Date(dateString)
    let localTime = localDate.getTime()
    return new Date(localTime).getTime()
  }

  async getIrreversibleBlockInfo() {
    let response = await this.getBlockInfo()
    let refBlockNum = response.last_irreversible_block_num & 0xffff
    let refBlockPrefixHex = response.last_irreversible_block_id.slice(16, 24)
    let refBlockPrefix = Buffer.from(refBlockPrefixHex, 'hex').readUInt32LE(0)
    return {
      lastIrreversibleBlockNum: response.last_irreversible_block_num,
      lastIrreversibleBlockId: response.last_irreversible_block_id,
      refBlockNum: refBlockNum,
      refBlockPrefix: refBlockPrefix
    }
  }

  async getAccountInfo(accountName, tokens) {
    if (!accountName || !tokens) {
      console.warn('EosPeer getAccountInfo invalid params', accountName, tokens)
      throw D.error.invalidParams
    }
    let url = this._apiUrl + 'v1/chain/get_account'
    let args = JSON.stringify({account_name: accountName})
    let ret = await this.post(url, args)

    let subEos = (a, b) => {
      a = a.substring(0, a.length - 4)
      b = b.substring(0, b.length - 4)

      let c = (new BigDecimal(a)).subtract(new BigDecimal(b))
      return c.toPlainString() + ' EOS'
    }

    let balance = (ret.core_liquid_balance && ret.core_liquid_balance.split(' ')[0]) || '0.0000'

    ret.voter_info = ret.voter_info || {
      proxy: '',
      producers: [],
      staked: 0,
      is_proxy: 0
    }
    ret.self_delegated_bandwidth = ret.self_delegated_bandwidth || {
      net_weight: '0.0000 EOS',
      cpu_weight: '0.0000 EOS'
    }

    let accountInfo = {
      balance: balance,
      resources: {
        ram: {
          used: ret.ram_usage,
          total: ret.ram_quota
        },
        net: {
          weight: ret.net_weight,
          used: ret.net_limit.used,
          available: ret.net_limit.available,
          max: ret.net_limit.max
        },
        cpu: {
          weight: ret.cpu_weight,
          used: ret.cpu_limit.used,
          available: ret.cpu_limit.available,
          max: ret.cpu_limit.max
        },
        stake: {
          net: {
            total: ret.total_resources.net_weight,
            self: ret.self_delegated_bandwidth.net_weight,
            others: subEos(ret.total_resources.net_weight, ret.self_delegated_bandwidth.net_weight)
          },
          cpu: {
            total: ret.total_resources.cpu_weight,
            self: ret.self_delegated_bandwidth.cpu_weight,
            others: subEos(ret.total_resources.cpu_weight, ret.self_delegated_bandwidth.cpu_weight)
          }
        },
        vote: {
          proxy: ret.voter_info.proxy,
          producers: ret.voter_info.producers,
          staked: Math.floor(ret.voter_info.staked / 10000).toString(),
          isProxy: ret.voter_info.is_proxy !== 0
        }
      }
    }

    accountInfo.permissions = {}
    ret.permissions.forEach(p => {
      accountInfo.permissions[p.perm_name] = {
        name: p.perm_name,
        parent: p.parent,
        threshold: p.required_auth.threshold,
        auth: p.required_auth,
        pKeys: p.required_auth.keys.map(key => {
          return {publicKey: key.key, weight: key.weight}
        })
      }
    })

    accountInfo.tokens = D.copy(tokens)
    let responses = await Promise.all(Object.values(tokens).map(token =>
      this._getTokenBalance(token.code, token.symbol, accountName)))
    responses.forEach(ret => {
      if (!ret) return
      let symbol = ret.split(' ')[1]
      accountInfo.tokens[symbol].value = ret.split(' ')[0]
    })

    return accountInfo
  }

  async _getTokenBalance (code, symbol, account) {
    let args = JSON.stringify({code, symbol, account})
    let url = this._apiUrl + 'v1/chain/get_currency_balance'
    let response = await this.post(url, args)
    return response[0]
  }

  async getAccountByPubKey (publicKey) {
    let args = JSON.stringify({public_key: publicKey})
    let url = this._apiUrl + 'v1/history/get_key_accounts'
    let response = await this.post(url, args)
    return response.account_names
  }

  async getVoteProducers (pageNum = 1, perPage = 50) {
    let url = D.test.coin ? 'https://www.api.bloks.io/jungle/producers' : 'https://www.api.bloks.io/producers'
    let response = await this.get(url + '?pageNum=' + pageNum + '&perPage=' + perPage)
    return response.producers
  }

  async getVoteProxies (pageNum = 1, perPage = 50) {
    let url = 'https://www.alohaeos.com/vote/proxy?output=json'
    // get eos testnet type, only support jungle & kylin currently
    if (D.test.coin) {
      let network = ''
      D.recoverCoinTypes().map(it => {
        if (it.startsWith('eos')) {
          network = it.slice(4)
        }
      })
      url = 'https://eosauthority.com/api/spa/proxies?network=' + network
    }
    let response = await this.get(url)
    return D.test.coin ? response : response.proxies
  }
}
