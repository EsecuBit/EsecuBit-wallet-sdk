import {BigDecimal, BigInteger} from 'bigdecimal'
import D from '../D'

export default class EthToken {
  constructor (tokenInfo, balance, txInfos, account, coinData) {
    if (tokenInfo.type !== 'ERC20') {
      console.warn('SDK not support tokens that are not ERC20')
      throw D.error.invalidParams
    }
    this.address = tokenInfo.address
    this.symbol = tokenInfo.symbol
    this.name = tokenInfo.name
    this.decimals = tokenInfo.decimals
    this.type = tokenInfo.type
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
    txInfos.forEach(t => { t.txId = t.txId.slice(0, -2) })
    txInfos.forEach(tx => this._coinData.setTxFlags(tx))
    return {total, txInfos}
  }

  async prepareTx (details) {
    if (details.data) throw D.error.invalidParams
    if (!details.output) throw D.error.invalidParams
    if (!details.output.address) throw D.error.invalidParams
    if (!details.output.value) throw D.error.invalidParams

    details.data = this._toErc20Data(details.output.address, details.output.value, this.decimals)
    details.output.address = this.address
    details.output.value = '0'
    details.gasLimit = details.gasLimit || '200000'
    return this._account.prepareTx(details)
  }

  async buildTx (prepareTx) {
    return this._account.buildTx(prepareTx)
  }

  async sendTx (signedTx) {
    return this._account.sendTx(signedTx)
  }

  _toErc20Data (receiver, value, decimals) {
    let receiverBuffer = Buffer.alloc(32)
    D.address.toBuffer(receiver).copy(receiverBuffer, 12)
    let valueBuffer = Buffer.alloc(32)

    let balance = new BigDecimal(this.balance)
    value = new BigDecimal(value)
    value = value.multiply(new BigDecimal(10 ** decimals))
    if (balance.compareTo(value) < 0) throw D.error.balanceNotEnough

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
    if (value.length % 2 === 1) {
      value = '0' + value
    }
    value = Buffer.from(value, 'hex')
    value.copy(valueBuffer, 32 - value.length)

    return '0x' + Buffer.concat([
      Buffer.from('a9059cbb', 'hex'),
      receiverBuffer,
      valueBuffer
    ]).toString('hex')
  }
}
