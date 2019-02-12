import {Bigdecimals, BigInteger} from 'bigdecimals'
import D from '../D'

export default class EthToken {
  static async getEthTokens (account, coinData) {
    let tokenInfos = await coinData.getTokens({accountId: account.accountId})
    let txInfos = await account.getTxInfos()

    let tokens = []
    for (let tokenInfo of tokenInfos) {
      let tokenTxInfos = txInfos
        .filter(t => t.outputs[0].address === tokenInfo.address)
        .filter(t => t.txId.endsWith('_t'))
      tokens.push(new EthToken(
        tokenInfo.address,
        tokenInfo.name,
        tokenInfo.decimals,
        tokenInfo.type,
        tokenInfo.balance,
        tokenTxInfos,
        account,
        coinData
      ))
    }
    return tokens
  }

  constructor (address, name, decimals, type, balance, txInfos, account, coinData) {
    this.address = address
    this.name = name
    this.decimals = decimals
    this.type = type
    this.accountId = account.accountId
    this.coinType = account.coinType
    this.balance = balance
    this.txInfos = txInfos
    this._account = account
    this._coinData = coinData
  }

  _toTokenInfo () {
    return {
      address: this.address,
      name: this.name,
      decimals: this.decimals,
      type: this.type,
      accountId: this.accountId,
      coinType: this.coinType,
      balance: this.balance
    }
  }

  async getTxInfos (startIndex, endIndex) {
    let txInfos = this.txInfos.sort((a, b) => b.time - a.time)
    let total = this.txInfos.length
    txInfos = D.copy(txInfos.slice(startIndex, endIndex))
    txInfos.forEach(tx => this._coinData.setTxFlags(tx))
    return {total, txInfos}
  }

  async prepareTx (details) {
    // TODO support ERC721
    details.data = EthToken._toErc20Data(details.output.address, details.output.value)
    details.output.address = this.address
    details.gasLimit = details.gasLimit || '200000'
    return this._account.prepareTx(details)
  }

  async signTx (prepareTx) {
    return this._account.signTx(prepareTx)
  }

  async sendTx (signedTx) {
    return this._account.sendTx(signedTx)
  }

  static _toErc20Data (receiver, value, decimals) {
    let receiverBuffer = Buffer.alloc(32)
    D.address.toBuffer(receiver).copy(receiverBuffer, 12)
    let valueBuffer = Buffer.alloc(32)

    value = new Bigdecimals(value)
    value = value.multiply(new Bigdecimals(10 ** decimals))
    value = value.toPlainString()
    if (value.includes('.')) {
      let index = value.length - 1
      while (value[index] === '0') index--
      if (value[index] === '.') index--
      value = value.slice(0, index + 1)
    }
    if (value.includes('.')) {
      throw D.error.valueIsDecimal
    }
    value = new BigInteger(value, 10)
    value = value.toString(16)
    value = Buffer.from(value, 'hex')
    valueBuffer.copy(value)

    return '0x' + Buffer.concat([
      receiverBuffer, valueBuffer
    ]).toString('hex')
  }
}
