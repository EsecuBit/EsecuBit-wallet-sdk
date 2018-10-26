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
    let response = await super.post(url, args)
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
    return this.queryActions(address, offset)
  }

  async queryActions (address, offset = 0) {
    const url = this._apiUrl + 'v1/history/get_actions'
    const defaultPageSize = 100

    let txs = []
    let currentOffset = offset + 1
    this._maxActionSeq[address] = offset
    while (true) {
      const args = JSON.stringify({pos: currentOffset, offset: defaultPageSize, account_name: address})
      let response = await this.post(url, args)

      for (let rAction of response.actions) {
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
      currentOffset += response.actions.length
      // caution: some nodes didn't return enough actions sometimes, like http://api.hkeos.com:80.
      // You may get [0, 5) even you query [0, 100), I don't known whether it's a common issue yet.
      if (response.actions.length === 0 || response.actions.length < defaultPageSize) {
        break
      }
    }
    return txs
  }

  async getMaxActionSeq (address) {
    if (this._maxActionSeq[address]) {
      return this._maxActionSeq[address]
    }

    console.warn('getMaxActionSeq before queryActions, it\'s not effective')
    await this.queryActions(address)

    if (!this._maxActionSeq[address]) {
      console.warn('unable to cache max account_action_seq, something went wrong..')
      throw D.error.unknown
    }
    return this._maxActionSeq[address]
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
        ? D.tx.confirmation.excuted
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
        ? D.tx.confirmation.excuted
        : D.tx.confirmation.waiting, // see D.tx.confirmation
      time: EosPeer._getTimeStamp(rAction.block_time),
      actions: [rAction.action_trace.act]
    }
  }

  static _getTimeStamp (dateString) {
    let localDate = new Date(dateString)
    let localTime = localDate.getTime()
    let localOffset = localDate.getTimezoneOffset() * 60 * 1000
    return Math.floor(new Date(localTime - localOffset).getTime() / 1000)
  }

  async getIrreversibleBlockInfo () {
    let response = await this.getBlockInfo()
    let refBlockNum = response.last_irreversible_block_num & 0xffff
    let refBlockPrefixHex = response.last_irreversible_block_id.slice(16, 24)
    let refBlockPrefix = Buffer.from(refBlockPrefixHex, 'hex').readUInt32BE(0)
    return {
      lastIrreversibleBlockNum: response.last_irreversible_block_num,
      lastIrreversibleBlockId: response.last_irreversible_block_id,
      refBlockNum: refBlockNum,
      refBlockPrefix: refBlockPrefix
    }
  }

  async getAccountInfo (accountName, tokens) {
    let url = this._apiUrl + 'v1/chain/get_account'
    let args = JSON.stringify({account_name: accountName})
    let ret = await this.post(url, args)

    const splitPaddingZero = (tokenValue) => {
      let value = tokenValue.split(' ')[0]
      let calPadZero = (zlen, c) => c === '0' ? zlen + 1 : 0
      let zLen = Array.reduce.call(value, value, calPadZero, 0)
      return value.slice(0, value.length - zLen)
    }

    let accountInfo = {
      balance: splitPaddingZero(ret.core_liquid_balance),
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
            net: splitPaddingZero(ret.total_resources.net_weight),
            cpu: splitPaddingZero(ret.total_resources.cpu_weight)
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
      accountInfo.tokens[symbol].value = splitPaddingZero(ret)
    })

    return accountInfo
  }

  async _getTokenBalance (code, symbol, account) {
    let args = JSON.stringify({code, symbol, account})
    let url = this._apiUrl + 'v1/chain/get_currency_balance'
    let response = await this.post(url, args)
    return response[0]
  }
}
