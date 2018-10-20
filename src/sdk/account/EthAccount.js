
import D from '../D'
import BigInteger from 'bigi'
import IAccount from './IAccount'

export default class EthAccount extends IAccount {
  async _checkAddressIndexAndGenerateNew () {
    if (this.addressInfos.length === 0) {
      let path = D.makeBip44Path(this.coinType, this.index, D.address.external, 0)
      let address = await this._device.getAddress(this.coinType, path)
      let addressInfo = {
        address: address,
        accountId: this.accountId,
        coinType: this.coinType,
        path: path,
        type: D.address.external,
        index: 0,
        txs: []
      }
      this.addressInfos.push(addressInfo)
      this._coinData.newAddressInfos(this._toAccountInfo(), [addressInfo])
    }
  }

  async _handleRemovedTx (removedTxId) {
    console.warn('eth removed txId', removedTxId)
    // async operation may lead to disorder. so we need a simple lock
    while (this.busy) {
      await D.wait(2)
    }
    this.busy = true

    let removedTxInfo = this.txInfos.find(txInfo => txInfo.txId === removedTxId)
    if (!removedTxInfo) {
      console.warn(this.accountId, 'removed txId not found', removedTxId)
      return
    }
    console.log('eth removed txInfo', removedTxInfo)

    removedTxInfo.confirmations = D.tx.confirmation.dropped
    this.addressInfos[0].txs = this.addressInfos[0].txs.filter(txId => txId !== removedTxId)

    // can't use BigInteger.ZERO here, addTo, subTo will modify the value of BigInteger.ZERO
    let newBalance = new BigInteger()
    newBalance.fromInt(0)
    this.txInfos
      .filter(txInfo => txInfo.confirmations !== D.tx.confirmation.dropped)
      .forEach(txInfo => {
        newBalance.addTo(new BigInteger(txInfo.value), newBalance)
        if (txInfo.direction === D.tx.direction.out) {
          newBalance.subTo(new BigInteger(txInfo.fee), newBalance)
        }
      })
    this.balance = newBalance.toString(10)

    await this._coinData.removeTx(this._toAccountInfo(), D.copy([this.addressInfos[0]]), D.copy(removedTxInfo))
    this.busy = false
  }

  async _handleNewTx (txInfo) {
    console.log('eth newTransaction', txInfo)
    // async operation may lead to disorder. so we need a simple lock
    while (this.busy) {
      await D.wait(2)
    }
    this.busy = true

    txInfo = D.copy(txInfo)
    txInfo.inputs.forEach(input => {
      input['isMine'] = this.addressInfos.some(a => a.address.toLowerCase() === input.prevAddress.toLowerCase())
    })
    txInfo.outputs.forEach(output => {
      output['isMine'] = this.addressInfos.some(a => a.address.toLowerCase() === output.address.toLowerCase())
    })
    let input = txInfo.inputs.find(input => input.isMine)
    txInfo.direction = input ? D.tx.direction.out : D.tx.direction.in
    txInfo.fee = new BigInteger(txInfo.gas).multiply(new BigInteger(txInfo.gasPrice)).toString(10)

    txInfo.value = txInfo.inputs[0].value
    if (txInfo.direction === D.tx.direction.out) txInfo.value = '-' + input.value

    txInfo.showAddresses = txInfo.direction === D.tx.direction.in
      ? txInfo.inputs.filter(inputs => !inputs.isMine).map(inputs => inputs.prevAddress)
      : txInfo.outputs.filter(output => !output.isMine).map(output => output.address)
    if (txInfo.showAddresses.length === 0) {
      txInfo.value = '0'
      txInfo.showAddresses.push('self')
    }

    // update account info
    let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
    if (index === -1) {
      txInfo.comment = ''
      this.txInfos.push(txInfo)
    } else {
      txInfo.comment = this.txInfos[index].comment
      this.txInfos[index] = txInfo
    }
    if (!this.addressInfos[0].txs.includes(txInfo.txId)) {
      this.addressInfos[0].txs.push(txInfo.txId)
    }

    // can't use BigInteger.ZERO here, addTo, subTo will modify the value of BigInteger.ZERO
    let newBalance = new BigInteger()
    newBalance.fromInt(0)
    this.txInfos
      .filter(txInfo => txInfo.confirmations !== D.tx.confirmation.dropped)
      .forEach(txInfo => {
        newBalance.addTo(new BigInteger(txInfo.value), newBalance)
        if (txInfo.direction === D.tx.direction.out) {
          newBalance.subTo(new BigInteger(txInfo.fee), newBalance)
        }
      })
    this.balance = newBalance.toString(10)

    await this._coinData.newTx(this._toAccountInfo(), D.copy([this.addressInfos[0]]), D.copy(txInfo), [])

    if (txInfo.confirmations !== D.tx.confirmation.dropped &&
      txInfo.confirmations < D.tx.getMatureConfirms(this.coinType) &&
      !this._listenedTxs.some(tx => tx === txInfo.txId)) {
      this._listenedTxs.push(txInfo.txId)
      this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
    }

    this.busy = false
  }

  async getAddress (isStoring = false) {
    await this._checkAddressIndexAndGenerateNew()
    let path = D.makeBip44Path(this.coinType, this.index, D.address.external, 0)
    let address = await this._device.getAddress(this.coinType, path, true, isStoring)
    address = D.address.toEthChecksumAddress(address)
    let prefix = ''
    return {address: address, qrAddress: prefix + address}
  }

  /**
   *
   * @param details
   * {
   *   sendAll: bool,
   *   oldTxId: hex string, // resend only
   *   output: {
   *     address: hex string,
   *     value: decimal integer string integer (Wei)
   *   }
   *   gasPrice: decimal integer string (Wei),
   *   gasLimit: decimal integer string (Wei),
   *   data: （0x) hex string (optional),
   *   comment: string (optional)
   * }
   * @returns {Promise<{total: *, fee: number, gasPrice: string, gasLimit: string, nonce: number, input: *, output: *, data: string}>}
   * {
   *   total: decimal integer string (Wei)
   *   fee: decimal integer string (Wei)
   *   gasPrice: decimal integer string (Wei)
   *   gasLimit: decimal integer string ( Wei)
   *   nonce: decimal integer string
   *   intput: addressInfo
   *   output: {
   *     address: hex string,
   *     value: string (decimal integer string Wei)
   *   }
   *   data: hex string
   * }
   */
  async prepareTx (details) {
    console.log('prepareTx details', details)

    if (Number(details.gasPrice) === 0) {
      console.warn('fee can not be 0')
      throw D.error.networkFeeTooSmall
    }

    if (!D.isEth(this.coinType)) throw D.error.coinNotSupported
    if (D.isDecimal(details.gasLimit)) throw D.error.valueIsDecimal
    if (D.isDecimal(details.gasPrice)) throw D.error.valueIsDecimal
    if (D.isDecimal(details.output.value)) throw D.error.valueIsDecimal

    let gasPrice = new BigInteger(details.gasPrice)
    let gasLimit = new BigInteger(details.gasLimit || '21000')
    let output = D.copy(details.output)
    let value = new BigInteger(output.value)

    if (details.data) {
      let data = details.data
      if (data.startsWith('0x')) data = data.slice(2)
      data = (data.length % 2 === 0 ? '' : '0') + data
      if (!data.match(/^[0-9a-fA-F]*$/)) throw D.error.invalidDataNotHex
      details.data = '0x' + data
    } else {
      details.data = '0x'
    }

    let minGas = 21000 + (details.data ? (68 * (details.data.length / 2 - 1)) : 0)
    if (minGas > gasLimit) throw D.error.networkGasTooLow

    let input = D.copy(this.addressInfos[0])
    let nonce
    if (details.oldTxId) {
      let oldTxInfo = this.txInfos.find(txInfo => txInfo.txId === details.oldTxId)
      if (!oldTxInfo) {
        console.warn('oldTxId not found in history')
        throw D.error.unknown
      }
      nonce = oldTxInfo.nonce
    } else {
      nonce = this.txInfos
        .filter(txInfo => txInfo.confirmations !== D.tx.confirmation.dropped)
        .filter(txInfo => txInfo.direction === D.tx.direction.out)
        .length
    }
    let fee = gasLimit.multiply(gasPrice)

    let balance = new BigInteger(this.balance)
    let total
    // noinspection JSUnresolvedVariable
    if (details.sendAll) {
      if (balance.compareTo(fee) < 0) throw D.error.balanceNotEnough
      total = balance
      value = total.subtract(fee)
      output.value = value.toString(10)
    } else {
      total = value.add(fee)
      if (total.compareTo(balance) > 0) throw D.error.balanceNotEnough
    }

    let prepareTx = {
      total: total.toString(10),
      fee: fee.toString(10),
      gasPrice: gasPrice.toString(10),
      gasLimit: gasLimit.toString(10),
      nonce: nonce,
      input: input,
      output: output,
      data: details.data,
      comment: details.comment || ''
    }
    console.log('prepareTx', prepareTx)
    return prepareTx
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    let output = D.copy(prepareTx.output)

    let gasPrice = new BigInteger(prepareTx.gasPrice).toString(16)
    gasPrice = '0x' + (gasPrice.length % 2 === 0 ? '' : '0') + gasPrice
    // '0x00' will be encode as 0x00; '0x', '', null, 0 will be encode as 0x80, shit
    if (gasPrice === '0x00') gasPrice = '0x'

    let gasLimit = new BigInteger(prepareTx.gasLimit).toString(16)
    gasLimit = '0x' + (gasLimit.length % 2 === 0 ? '' : '0') + gasLimit
    if (gasLimit === '0x00') gasLimit = '0x'

    let value = new BigInteger(output.value).toString(16)
    value = '0x' + (value.length % 2 === 0 ? '' : '0') + value
    if (value === '0x00') value = '0x'

    let preSignTx = {
      input: {address: prepareTx.input.address, path: prepareTx.input.path},
      output: {address: output.address, value: value},
      nonce: prepareTx.nonce,
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      data: prepareTx.data
    }
    console.log('preSignTx', preSignTx)
    let signedTx = await this._device.signTransaction(this.coinType, preSignTx)

    return {
      txInfo: {
        accountId: this.accountId,
        coinType: this.coinType,
        txId: signedTx.id,
        blockNumber: -1,
        confirmations: -1,
        time: new Date().getTime(),
        direction: D.tx.direction.out,
        showAddresses: [output.address],
        value: '-' + output.value,
        inputs: [{
          prevAddress: prepareTx.input.address,
          isMine: true,
          value: output.value
        }],
        outputs: [{
          address: output.address,
          isMine: false,
          value: output.value
        }],
        gas: BigInteger.fromHex(gasLimit.slice(2)).toString(10),
        gasPrice: BigInteger.fromHex(gasPrice.slice(2)).toString(10),
        fee: prepareTx.fee,
        nonce: prepareTx.nonce,
        data: prepareTx.data,
        comment: prepareTx.comment
      },
      addressInfo: prepareTx.input,
      hex: signedTx.hex
    }
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
    if (!test) await this._coinData.sendTx(this._toAccountInfo(), [], signedTx.txInfo, signedTx.hex)
    await this._handleNewTx(signedTx.txInfo)
  }
}
