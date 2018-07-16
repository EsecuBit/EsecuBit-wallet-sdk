
import D from './D'

export default class BtcAccount {
  constructor (info, device, coinData) {
    let assign = () => {
      this.accountId = info.accountId
      this.label = info.label
      this.coinType = info.coinType
      this.index = info.index
      this.balance = info.balance
      this.externalPublicKeyIndex = info.externalPublicKeyIndex
      this.changePublicKeyIndex = info.changePublicKeyIndex
    }
    assign()
    this._device = device
    this._coinData = coinData
    this._listenedTxs = []

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
      await this._handleNewTx(addressInfo, txInfo, utxos)
    }
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = (await this._coinData.getTxInfos({accountId})).txInfos
    this.utxos = await this._coinData.getUtxos({accountId})
    let newAddressInfos = await this._checkAddressIndexAndGenerateNew()
    await this._coinData.newAddressInfos(this._toAccountInfo(), newAddressInfos)
  }

  // TODO judge recover from compress or uncompress public key
  async sync (firstSync = false) {
    let newAddressInfos = await this._checkAddressIndexAndGenerateNew(true)
    await this._coinData.newAddressInfos(this._toAccountInfo(), newAddressInfos)

    let checkAddressInfos = this.addressInfos
    while (true) {
      // find out all the transactions
      let blobs = await this._coinData.checkAddresses(this.coinType, checkAddressInfos)
      let responses = await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos, true)))
      responses = responses.reduce((array, item) => array.concat(item), [])
      if (responses.length === 0) break
      // noinspection JSUnresolvedVariable
      checkAddressInfos = responses.reduce((array, response) => array.concat(response.newAddressInfos), [])
    }

    if (firstSync) {
      let listenAddressInfos = this._getAddressInfos(0, this.externalPublicKeyIndex + 1, D.address.external)
      if (listenAddressInfos.length !== 0) this._coinData.listenAddresses(this.coinType, listenAddressInfos, this._addressListener)

      this.txInfos.filter(txInfo => txInfo.confirmations < D.tx.getMatureConfirms(this.coinType))
        .filter(txInfo => !this._listenedTxs.includes(txInfo.txId))
        .forEach(txInfo => {
          this._listenedTxs.push(txInfo.txId)
          this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
        })
    }
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
  async _handleNewTx (addressInfo, txInfo, utxos, isSyncing = false) {
    console.log('newTransaction', addressInfo, txInfo, utxos, isSyncing)

    // async operation may lead to disorder. so we need a simple lock
    // eslint-disable-next-line
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true
    txInfo.inputs.forEach(input => {
      input['isMine'] = this.addressInfos.some(a => a.address === input.prevAddress)
    })
    txInfo.outputs.forEach(output => {
      output['isMine'] = this.addressInfos.some(a => a.address === output.address)
    })
    txInfo.value = 0
    txInfo.value -= txInfo.inputs.reduce((sum, input) => sum + input.isMine ? input.value : 0, 0)
    txInfo.value += txInfo.outputs.reduce((sum, output) => sum + output.isMine ? output.value : 0, 0)
    let input = txInfo.inputs.find(input => input.isMine)
    txInfo.direction = input ? D.tx.direction.out : D.tx.direction.in
    txInfo.showAddresses = txInfo.direction === D.tx.direction.in
      ? txInfo.inputs.filter(inputs => !inputs.isMine).map(inputs => inputs.prevAddress)
      : txInfo.outputs.filter(output => !output.isMine).map(output => output.address)
    if (txInfo.showAddresses.length === 0) txInfo.showAddresses.push('self')

    // check utxo update.
    // unspent_pending can update to other state
    // unspent can update to pending_spent and spent
    // pending_spent can update to spent
    utxos = utxos.filter(utxo => {
      let oldUtxo = this.utxos.find(oldUtxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index)
      if (!oldUtxo) return true
      if (oldUtxo.status === D.utxo.status.unspent_pending) return true
      if (oldUtxo.status === D.utxo.status.unspent) return utxo.status === D.utxo.status.spent_pending || utxo.status === D.utxo.status.spent
      if (oldUtxo.status === D.utxo.status.spent_pending) return utxo.status === D.utxo.status.spent
      return false
    })

    // update account info
    let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
    if (index === -1) {
      this.txInfos.push(txInfo)
    } else {
      this.txInfos[index] = txInfo
    }
    this.utxos = this.utxos
      .filter(oldUtxo => !utxos.some(utxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index))
      .concat(utxos)
    this.addressInfos.find(a => a.address === addressInfo.address).txs = D.copy(addressInfo.txs)
    this.balance = this.utxos
      .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
      .reduce((sum, utxo) => sum + utxo.value, 0)

    // update and addressIndex and listen new address
    let newIndex = addressInfo.index + 1
    let oldIndex = addressInfo.type === D.address.external ? this.externalPublicKeyIndex : this.changePublicKeyIndex
    addressInfo.type === D.address.external ? this.externalPublicKeyIndex = newIndex : this.changePublicKeyIndex = newIndex
    await this._device.updateIndex(this)
    let newAddressInfos = await this._checkAddressIndexAndGenerateNew(isSyncing)
    await this._coinData.newAddressInfos(this._toAccountInfo(), newAddressInfos)
    await this._coinData.newTx(this._toAccountInfo(), addressInfo, txInfo, utxos)

    if (!isSyncing) {
      let newListeneAddressInfos = this._getAddressInfos(oldIndex, newIndex + 1, addressInfo.type)
      if (newListeneAddressInfos.length !== 0) this._coinData.listenAddresses(this.coinType, newListeneAddressInfos, this._addressListener)
    }
    if (txInfo.confirmations < D.tx.getMatureConfirms(this.coinType)) {
      if (!this._listenedTxs.some(tx => tx === txInfo.txId)) {
        this._listenedTxs.push(txInfo.txId)
        this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
      }
    }
    this.busy = false

    // find out changeAddreses for this tx
    let relativeAddresses = [].concat(
      txInfo.inputs.filter(input => input.isMine).map(input => input.prevAddress),
      txInfo.outputs.filter(input => input.isMine).map(output => output.address))
    let changeAddresses = this.addressInfos
      .filter(a => a.type === D.address.change)
      .filter(a => !a.txs.includes(txInfo.txId))
      .filter(a => relativeAddresses.find(address => a.address === address))
    changeAddresses.forEach(a => a.txs.push(txInfo.txId))
    let changeResponses = await Promise.all(changeAddresses.map(a => this._handleNewTx(a, txInfo, utxos, true)))
    changeResponses = changeResponses.reduce((array, item) => array.concat(item), [])

    return [{addressInfo, txInfo, utxos, newAddressInfos}].concat(changeResponses)
  }

  /**
   * check address index and genreate new necessary addressInfos
   * @private
   */
  async _checkAddressIndexAndGenerateNew (sync = false) {
    let checkAndGenerate = async (type) => {
      let isExternal = type === D.address.external
      let index = isExternal ? this.externalPublicKeyIndex : this.changePublicKeyIndex
      let maxIndex = this.addressInfos.filter(addressInfo => addressInfo.type === type)
        .reduce((max, addressInfo) => Math.max(max, addressInfo.index), -1)
      let nextIndex = maxIndex + 1

      sync ? index += 20 : index += 1
      nextIndex = nextIndex > index + 20 ? index + 20 : nextIndex
      if (index > nextIndex) {
        console.log(this.accountId, 'generating', type, 'addressInfos, from', nextIndex, 'to', index)
      }
      return (await Promise.all(Array.from({length: index - nextIndex}, (v, k) => nextIndex + k).map(async i => {
        let address = await this._device.getAddress(this.coinType, D.makeBip44Path(this.coinType, this.index, type, i))
        return {
          address: address,
          accountId: this.accountId,
          coinType: this.coinType,
          path: D.makeBip44Path(this.coinType, this.index, type, i),
          type: type,
          index: i,
          txs: []
        }
      }))).filter(addressInfo => addressInfo !== null)
    }

    let newAddresseInfos = [].concat(await checkAndGenerate(D.address.external), await checkAndGenerate(D.address.change))
    this.addressInfos.push(...newAddresseInfos)
    return newAddresseInfos
  }

  _getAddressInfos (startIndex, stopIndex, type, copy = true) {
    let addressInfos = this.addressInfos.filter(a => a.type === type && a.index >= startIndex && a.index < stopIndex)
    if (copy) addressInfos = addressInfos.map(addressInfo => D.copy(addressInfo))
    return addressInfos
  }

  _toAccountInfo () {
    return {
      accountId: this.accountId,
      label: this.label,
      coinType: this.coinType,
      index: this.index,
      balance: this.balance,
      externalPublicKeyIndex: this.externalPublicKeyIndex,
      changePublicKeyIndex: this.changePublicKeyIndex
    }
  }

  getTxInfos (startIndex, endIndex) {
    let accountId = this.accountId
    return this._coinData.getTxInfos({accountId, startIndex, endIndex})
  }

  async getAddress () {
    let address = await this._device.getAddress(this.coinType,
      D.makeBip44Path(this.coinType, this.index, D.address.external, this.externalPublicKeyIndex), true)
    let prefix = ''
    return {address: address, qrAddress: prefix + address}
  }

  getSuggestedFee () {
    return this._coinData.getSuggestedFee(this.coinType).fee
  }

  // noinspection JSMethodCanBeStatic
  checkAddress (address) {
    return D.address.checkBtcAddress(address)
  }

  /**
   *
   * @param details
   * {
   *   sendAll: bool,
   *   feeRate: long (santoshi),
   *   outputs: [{
   *     address: base58 string,
   *     value: long (santoshi)
   *   }]
   * }
   * @returns {Promise<prepareTx>}
   * {
   *   total: long (santoshi)
   *   fee: long (santoshi)
   *   feeRate: long (santoshi),
   *   utxos: utxo array,
   *   outputs: [{
   *     address: base58 string,
   *     value: long (santoshi)
   *   }]
   * }
   */
  async prepareTx (details) {
    if (!D.isBtc(this.coinType)) throw D.error.coinNotSupported

    let utxos = this.utxos
      .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
      .map(utxo => D.copy(utxo))
    let getEnoughUtxo = (total, sendAll) => {
      let willSpentUtxos = []
      let newTotal = 0
      for (let utxo of utxos) {
        newTotal += utxo.value
        willSpentUtxos.push(utxo)
        if (!sendAll && newTotal > total) {
          break
        }
      }
      if (newTotal <= total) {
        throw D.error.balanceNotEnough
      }
      return {newTotal, willSpentUtxos}
    }

    let fee = 0
    let totalOut = details.outputs.reduce((sum, output) => sum + output.value, 0)
    // no output value is ok while sendAll = true
    totalOut = totalOut || 0

    // calculate the fee using uncompressed public key size
    let calculateFee = (utxos, outputs) => (utxos.length * 180 + 34 * outputs.length + 34 + 10) * details.feeRate
    while (true) {
      if (this.balance < fee + totalOut) throw D.error.balanceNotEnough
      // noinspection JSUnresolvedVariable
      let {newTotal, willSpentUtxos} = getEnoughUtxo(totalOut + fee, details.sendAll)
      // new fee calculated
      fee = calculateFee(willSpentUtxos, details.outputs)
      if (newTotal >= totalOut + fee) {
        if (details.sendAll) {
          details.outputs[0].value = newTotal - fee
        }
        return {
          feeRate: details.feeRate,
          outputs: D.copy(details.outputs),
          fee: fee,
          total: totalOut + fee,
          utxos: willSpentUtxos
        }
      }
      // new fee + total out is larger than new total, calculate again
    }
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, utxos, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    let totalOut = prepareTx.outputs.reduce((sum, output) => sum + output.value, 0)
    if (totalOut + prepareTx.fee !== prepareTx.total) throw D.error.unknown
    let totalIn = prepareTx.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    if (totalIn < prepareTx.total) throw D.error.balanceNotEnough

    let changeAddressInfo = this.addressInfos.find(addressInfo => {
      return addressInfo.type === D.address.change &&
      addressInfo.index === this.changePublicKeyIndex
    })
    let value = totalIn - prepareTx.total
    let rawTx = {
      inputs: prepareTx.utxos,
      outputs: prepareTx.outputs,
      changePath: changeAddressInfo.path
    }
    rawTx.outputs.push({address: changeAddressInfo.address, value: value})
    console.log('presign tx', rawTx)
    let signedTx = await this._device.signTransaction(this.coinType, rawTx)
    let txInfo = {
      accountId: this.accountId,
      coinType: this.coinType,
      txId: signedTx.id,
      version: 1,
      blockNumber: -1,
      confirmations: -1,
      time: new Date().getTime(),
      direction: D.tx.direction.out,
      value: prepareTx.total,
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
          isMine: output.address === changeAddressInfo.address,
          value: output.value
        }
      })
    }

    // change utxo spent status from unspent to spent pending
    prepareTx.utxos.forEach(utxo => { utxo.status = D.utxo.status.spent_pending })
    let changeOutput = txInfo.outputs[txInfo.outputs.length - 1]
    let changeAddressBuffer = D.address.toBuffer(changeAddressInfo.address)
    let changeUtxo = {
      accountId: this.accountId,
      coinType: this.coinType,
      address: changeOutput.address,
      path: changeAddressInfo.path,
      txId: txInfo.txId,
      index: txInfo.outputs.length - 1,
      value: totalIn - totalOut,
      status: D.utxo.status.unspent_pending,
      // P2PKH script
      script: '76a914' + D.toHex(changeAddressBuffer) + '88ac'
    }
    prepareTx.utxos.push(changeUtxo)

    return {txInfo: txInfo, utxos: prepareTx.utxos, hex: signedTx.hex}
  }

  /**
   * broadcast transaction to btcNetwork
   * @param signedTx
   * @param test won't broadcast to btcNetwork if true
   * @see signedTx
   */
  async sendTx (signedTx, test = false) {
    // broadcast transaction to network
    console.log('sendTx', signedTx)
    if (!test) await this._coinData.sendTx(this._toAccountInfo(), signedTx.utxos, signedTx.txInfo, signedTx.hex)
    let blobs = {}
    signedTx.utxos.forEach(utxo => {
      let addressInfo = D.copy(this.addressInfos.find(addressInfo => addressInfo.address === utxo.address))
      if (blobs[addressInfo.address]) {
        blobs[addressInfo.address].utxos.push(utxo)
      } else {
        blobs[addressInfo.address] = {addressInfo: addressInfo, utxos: [utxo]}
        addressInfo.txs.push(signedTx.txInfo.txId)
      }
    })
    Object.values(blobs).forEach(blob => this._handleNewTx(blob.addressInfo, signedTx.txInfo, blob.utxos))
  }
}
