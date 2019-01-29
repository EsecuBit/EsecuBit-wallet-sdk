import {Bigdecimals, BigInteger} from 'bigdecimals'
import D from '../D'

export default class EthToken {
  static async getEthTokens (account, coinData) {
    let tokenInfos = await coinData.getTokens({accountId: account.accountId})
    let txInfos = await account.getTxInfos()

    let tokens = []
    for (let tokenInfo of tokenInfos) {
      let tokenTxInfos = txInfos.filter(t => t.outputs[0].address === tokenInfo.address)
      tokenTxInfos = tokenTxInfos.map(t => {
        // TODO query erc20?
      })
      tokens.push(new EthToken(
        tokenInfo.address,
        tokenInfo.name,
        tokenInfo.decimals,
        tokenInfo.balance,
        tokenInfos,
        account,
        coinData
      ))
    }
    return tokens
  }

  constructor (address, name, decimals, balance, txInfos, account) {
    this.address = address
    this.name = name
    this.decimals = decimals
    this.accountId = account.accountId
    this.coinType = account.coinType
    this.balance = balance
    this.account = account
    this.txInfos = txInfos
  }

  _toTokenInfo () {
    return {
      address: this.address,
      name: this.name,
      decimals: this.decimals,
      accountId: this.accountId,
      coinType: this.coinType,
      balance: this.balance
    }
  }

  async getTxInfos () {
    return this.txInfos
  }

  async prepareTx (details) {
    details.data = this._toErc20Data(details.output.address, details.output.value)
    details.output.address = this.address
    return this.account.prepareTx(details)
  }

  async signTx (prepareTx) {
    return this.account.signTx(prepareTx)
  }

  async sendTx (signedTx) {
    return this.account.sendTx(signedTx)
  }

  static _parseErc20Data (data, decimals) {
    if (typeof data === 'string') {
      if (data.startsWith('0x')) {
        data = data.substring(2)
      }
      data = Buffer.from(data, 'hex')
    }
    if (data.length !== 68) {
      return null
    }
    if (!(data.slice(0, 4).toString('hex').toUpperCase() === 'A9059CBB')) {
      return null
    }
    if (!(data.slice(4 + 32, 4 + 32 + 12).toString('hex') === '000000000000000000000000')) {
      return null
    }

    let value = new BigInteger(data.slice(4, 4 + 32).toString('hex'), 16)
    let rawValue = value.toString()
    value = new Bigdecimals(rawValue)
    value = value.divide(new Bigdecimals(10 ** decimals))
    let address = D.address.toString(D.coin.main.eth, data.slice(4 + 32 + 12))

    return {value, rawValue, address}
  }

  static _toErc20Data (receiver, value, decimals) {
    let receiverBuffer = Buffer.alloc(32)
    D.address.toBuffer(receiver).copy(receiverBuffer, 12)
    let valueBuffer = Buffer.alloc(32)

    value = new Bigdecimals(value)
    value = value.divide(new Bigdecimals(10 ** decimals))

    return '0x' + Buffer.concat([
      receiverBuffer, valueBuffer
    ]).toString('hex')
  }
}
