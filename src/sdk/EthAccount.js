
import D from './D'

export default class EthAccount {
  constructor (info, device, coinData) {
    let assign = () => {
      this.accountId = info.accountId
      this.label = info.label
      this.coinType = info.coinType
      this.index = info.index
      this.balance = info.balance
      this.externalPublicKey = info.externalPublicKey
      this.externalPublicKeyIndex = info.externalPublicKeyIndex
    }
    assign()
    this._device = device
    this._coinData = coinData

    this._txListener = async (error, txInfo) => {
      if (error !== D.error.succeed) {
        console.warn('BtcAccount txListener', error)
        return
      }
      console.log('newTransaction status', txInfo)
      let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
      if (index === -1) {
        console.warn('this should not happen, add it')
        this.txInfos.push(txInfo)
      } else {
        this.txInfos[index] = txInfo
      }
      await this._coinData.saveOrUpdateTxInfo(txInfo)
    }

    this._addressListener = async (error, addressInfo, txInfo, utxos) => {
      if (error !== D.error.succeed) {
        console.warn('BtcAccount addressListener', error)
        return
      }
      console.log('newTransaction', addressInfo, addressInfo, txInfo, utxos)
      await this._handleNewTx(addressInfo, txInfo, utxos)
    }
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = (await this._coinData.getTxInfos({accountId})).txInfos
    if (!this.addressInfos.length) {
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

  async sync () {
    // find out all the transactions
    let blobs = await this._coinData.checkAddresses(this.coinType, this.addressInfos)
    await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos, true)))
    this._coinData.listenAddresses(this.coinType, D.copy(this.addressInfos), this._addressListener)

    this.txInfos.filter(txInfo => txInfo.confirmations < D.tx.matureConfirms.eth)
      .forEach(txInfo => this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener))
  }

  async delete () {
    this._coinData.removeNetworkListener(this.coinType, this._txListener)
    this._coinData.removeNetworkListener(this.coinType, this._addressListener)
    await this._coinData.deleteAccount(this._toAccountInfo())
  }

  async rename (newName) {
    newName = newName || this.label
    let oldAccountInfo = this._toAccountInfo()
    oldAccountInfo.label = newName
    await this._coinData.renameAccount(oldAccountInfo)
    this.label = newName
  }

  /**
   * handle when new transaction comes:
   * 1. store/update new txInfo after filling "isMine" and "value" field
   * 2. store utxo, addressInfo, txInfo
   */
  async _handleNewTx (addressInfo, txInfo) {
    // async operation may lead to disorder. so we need a simple lock
    // eslint-disable-next-line
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true
    txInfo.inputs.forEach(input => { input['isMine'] = this.addressInfos.some(a => a.address === input.prevAddress) })
    txInfo.outputs.forEach(output => { output['isMine'] = this.addressInfos.some(a => a.address === output.address) })
    txInfo.value = 0
    txInfo.value -= txInfo.inputs.reduce((sum, input) => sum + input.isMine ? input.value : 0, 0)
    txInfo.value += txInfo.outputs.reduce((sum, output) => sum + output.isMine ? output.value : 0, 0)

    // update account info
    this.balance += txInfo.value
    this.txInfos.push(D.copy(txInfo))

    await this._coinData.newTx(this._toAccountInfo(), addressInfo, txInfo, [])

    if (txInfo.confirmations < D.tx.matureConfirms.eth) {
      console.log('listen transaction status', txInfo)
      if (!this._listenedTxs.some(tx => tx === txInfo.txId)) {
        this._listenedTxs.push(txInfo.txId)
        this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
      }
    }

    this.busy = false
  }

  _toAccountInfo () {
    return {
      accountId: this.accountId,
      label: this.label,
      coinType: this.coinType,
      index: this.index,
      balance: this.balance
    }
  }

  async getTxInfos (startIndex, endIndex) {
    startIndex = startIndex || 0
    endIndex = endIndex || this.txInfos.length
    return {
      total: this.txInfos.length,
      txInfos: this.txInfos.slice(startIndex, endIndex)
    }
  }

  async getAddress () {
    let path = D.makeBip44Path(this.coinType, this.index, 0, 0)
    let address = await this._device.getAddress(this.coinType, path)
    let prefix
    switch (this.coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        prefix = 'btc:'
        break
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        prefix = 'eth:'
        break
      default:
        throw D.error.coinNotSupported
    }
    return {address: address, qrAddress: prefix + address}
  }

  getSuggestedFee () {
    return this._coinData.getSuggestedFee(this.coinType).fee
  }

  /**
   *
   * @param details
   * {
   *   feeRate: long (btc -> santoshi) per byte,
   *   outputs: [{
   *     address: base58 string,
   *     value: long (btc -> santoshi)
   *   }]
   * }
   * @returns {Promise<prepareTx>}
   * {
   *   total: long (btc -> santoshi)
   *   fee: long (btc -> santoshi)
   *   feeRate: long (btc -> santoshi) per byte,
   *   utxos: utxo array,
   *   outputs: [{
   *     address: base58 string,
   *     value: long (btc -> santoshi)
   *   }]
   * }
   */
  async prepareTx (details) {
    // TODO
    if (this.coinType !== D.coin.main.btc && this.coinType !== D.coin.test.btcTestNet3) throw D.error.coinNotSupported

    let getEnoughUtxo = (total) => {
      let willSpentUtxos = []
      let newTotal = 0
      for (let utxo of utxos) {
        newTotal += utxo.value
        willSpentUtxos.push(utxo)
        if (newTotal > total) {
          break
        }
      }
      if (newTotal <= total) {
        throw D.error.txNotEnoughValue
      }
      return {newTotal, willSpentUtxos}
    }

    // copy utxos for avoiding utxos of BtcAccount change
    let utxos = this.utxos.filter(utxo => utxo.spent === D.utxo.status.unspent).map(utxo => D.copy(utxo))
    let total = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    let fee = details.feeRate
    let totalOut = details.outputs.reduce((sum, output) => sum + output.value, 0)
    // calculate the fee using uncompressed public key
    let calculateFee = (utxos, outputs) => (utxos.length * 180 + 34 * outputs.length + 34 + 10) * details.feeRate
    let result
    while (true) {
      if (total < fee + totalOut) throw D.error.txNotEnoughValue
      result = getEnoughUtxo(totalOut + fee)
      // new fee calculated
      fee = calculateFee(result.willSpentUtxos, details.outputs)
      if (result.newTotal > totalOut + fee) {
        return {
          feeRate: details.feeRate,
          outputs: details.outputs,
          fee: fee,
          total: totalOut + fee,
          utxos: result.willSpentUtxos
        }
      }
      // new fee + total out is larger than new total, calculate again
    }
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    // TODO
    let totalOut = prepareTx.outputs.reduce((sum, output) => sum + output.value, 0)
    if (totalOut + prepareTx.fee !== prepareTx.total) throw D.error.unknown
    let totalIn = prepareTx.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    if (totalIn < prepareTx.total) throw D.error.txNotEnoughValue

    let changeAddress = await this._device.getAddress(this.coinType, this.changePublicKeyIndex, this.changePublicKey)
    let value = totalIn - prepareTx.total
    let rawTx = {
      inputs: prepareTx.utxos,
      outputs: prepareTx.outputs
    }
    rawTx.outputs.push({address: changeAddress, value: value})
    console.log(rawTx)
    let signedTx = await this._device.signTransaction(rawTx)
    let txInfo = {
      accountId: this.accountId,
      coinType: this.coinType,
      txId: signedTx.id,
      version: 1,
      blockNumber: -1,
      confirmations: -1,
      time: new Date().getTime(),
      direction: D.tx.direction.out,
      inputs: prepareTx.utxos.map(utxo => {
        return {
          prevAddress: utxo.address,
          isMine: true,
          value: utxo.value
        }
      }),
      outputs: prepareTx.outputs.map(output => {
        return {
          address: output.address,
          isMine: output.address === changeAddress,
          value: output.value
        }
      }),
      value: prepareTx.total
    }
    return {txInfo: txInfo, utxos: prepareTx.utxos, hex: signedTx.hex}
  }

  /**
   * broadcast transaction to network
   * @param signedTx
   * @param test won't broadcast to network if true
   * @see signedTx
   */
  async sendTx (signedTx, test = false) {
    // TODO
    // broadcast transaction to network
    if (!test) await this._coinData.sendTx(this._toAccountInfo(), signedTx.utxos, signedTx.txInfo, signedTx.hex)
    // change utxo spent status from unspent to spent pending
    signedTx.utxos.forEach(utxo => { utxo.spent = D.utxo.status.pending })
    signedTx.utxos.map(utxo => {
      let addressInfo = this.addressInfos.find(addressInfo => addressInfo.address === utxo.address)
      return {addressInfo, utxo}
    }).forEach(pair => this._handleNewTx(pair.addressInfo, signedTx.txInfo, [pair.utxo]))
  }
}
