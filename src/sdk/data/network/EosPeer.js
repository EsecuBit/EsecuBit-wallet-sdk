import ICoinNetwork from './ICoinNetwork'
import D from '../../D'

// jungle
const jungle = {
  httpEndpoint: 'http://dev.cryptolions.io:38888/',
  provider: 'dev.cryptolions.io'
}

// TODO configurable
const main = {
  // httpEndpoint: 'http://api.hkeos.com:80/',
  httpEndpoint: 'https://eos.greymass.com/',
  provider: 'eos.greymass.com'
}

const eosParkTxUrl = 'https://eospark.com/MainNet/tx/'

export default class EosPeer extends ICoinNetwork {
  async init () {
    this._maxActionSeq = {}

    switch (this.coinType) {
      case D.coin.main.eos:
        this.provider = main.provider
        this._apiUrl = main.httpEndpoint
        break
      case D.coin.test.eosJungle:
        this.provider = jungle.provider
        this._apiUrl = jungle.httpEndpoint
        break
      default:
        console.warn('EosPeer don\'t support this coinType yet', this.coinType)
        throw D.error.coinNotSupported
    }
    this._txUrl = eosParkTxUrl
    if (!this._apiUrl) throw D.error.coinNotSupported
    return super.init()
  }

  async post (url, args) {
    let response = await super.post(url, args, 'application/json')
    if (response.code) {
      console.warn('EosPeer post error', response)
      switch (response.error.code) {
        case 3040005:
          throw D.error.networkEosTxExpired
        case 3090003:
          throw D.error.networkEosUnsatisfiedAuth
        default:
          throw D.error.networkTxNotFound
      }
    }
    return response
  }

  getTxLink (txInfo) {
    return this._txUrl + txInfo.txId
  }

  getBlockInfo () {
    let url = this._apiUrl + 'v1/chain/get_info'
    return this.post(url)
  }

  /**
   * get the irreversible block height
   * @returns {Promise<*>}
   */
  async getBlockHeight () {
    let response = await this.getIrreversibleBlockInfo()
    return response.lastIrreversibleBlockNum
  }

  async getRealBlockHeight () {
    let response = await this.getBlockInfo()
    return response.head_block_num
  }

  async queryAddress (address, offset = 0) {
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

  async queryActions (accountName, offset = 0) {
    const url = this._apiUrl + 'v1/history/get_actions'
    const defaultPageSize = 100

    let actions = []
    let currentOffset = offset + 1
    this._maxActionSeq[accountName] = offset
    while (true) {
      const args = JSON.stringify({pos: currentOffset, offset: defaultPageSize, account_name: accountName})
      let response = await this.post(url, args)

      // filter actions that don't care
      response.actions = response.actions.filter(action =>
        action.action_trace.act.authorization.actor === accountName ||
        Object.values(action.action_trace.act.data).includes(accountName))

      // filter actions that it's the same
      response.actions = response.actions.reduce((actions, action) => {
        if (!actions.some(a =>
          a.action_trace.receipt.act_digest === action.action_trace.receipt.act_digest)) {
          actions.push(action)
        }
        return actions
      }, [])

      actions.push(...response.actions)
      currentOffset += response.actions.length

      // caution: some nodes didn't return enough actions sometimes, like http://api.hkeos.com:80.
      // You may get [0, 5) even you query [0, 100), I don't known whether it's a common issue yet.
      if (response.actions.length === 0 || response.actions.length < defaultPageSize) {
        break
      }
    }
    return actions
  }

  getNextActionSeq (address) {
    if (this._maxActionSeq[address]) {
      return this._maxActionSeq[address] + 1
    }
    return 0
  }

  async queryTx (txId) {
    const url = this._apiUrl + 'v1/history/get_transaction'
    const args = JSON.stringify({id: txId})
    let response = await this.post(url, args)
    return this._wrapTx(response)
  }

  async sendTx (rawTransaction) {
    const url = this._apiUrl + 'v1/chain/push_transaction'
    const args = JSON.stringify(rawTransaction)
    await this.post(url, args)
  }

  _wrapTx (rTx) {
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

  _wrapActionToTx (rAction) {
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

  static _getTimeStamp (dateString) {
    let localDate = new Date(dateString)
    let localTime = localDate.getTime()
    let localOffset = localDate.getTimezoneOffset() * 60 * 1000
    return new Date(localTime - localOffset).getTime()
  }

  async getIrreversibleBlockInfo () {
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

  async getAccountInfo (accountName, tokens) {
    if (!accountName || !tokens) {
      console.warn('EosPeer getAccountInfo invalid params', accountName, tokens)
      throw D.error.invalidParams
    }
    let url = this._apiUrl + 'v1/chain/get_account'
    let args = JSON.stringify({account_name: accountName})
    let ret = await this.post(url, args)

    let accountInfo = {
      balance: ret.core_liquid_balance,
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
          total: {
            net: ret.total_resources.net_weight,
            cpu: ret.total_resources.cpu_weight
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
        pKeys: p.required_auth.keys.map(key => { return {publicKey: key.key, weight: key.weight} })
      }
    })

    accountInfo.tokens = D.copy(tokens)
    let responses = await Promise.all(Object.values(tokens).map(token =>
      this._getTokenBalance(token.code, token.symbol, accountName)))
    responses.forEach(ret => {
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
}
