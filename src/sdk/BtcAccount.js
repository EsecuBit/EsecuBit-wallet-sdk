
import D from './D'
import BtcCoinSelect from './BtcCoinSelect'

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
    this._listenedAddresses = []

    this._txListener = async (error, txInfo, isLost = false) => {
      if (error !== D.error.succeed) {
        console.warn('BtcAccount txListener', error)
        return
      }
      console.log('newTransaction status', txInfo)

      if (isLost) {
        let addressInfos = this.addressInfos.filter(addressInfo => addressInfo.txs.includes(txInfo.txId))
        for (let addressInfo of addressInfos) {
          await this._handleRemovedTx(addressInfo, txInfo.txId)
        }
        return
      }

      // find out all the self addresses
      let selfAddressInfos = []
      txInfo.inputs.filter(input => input.isMine).forEach(input => {
        let addressInfo = this.addressInfos.find(a => input.prevAddress === a.address)
        if (!selfAddressInfos.includes(addressInfo)) {
          selfAddressInfos.push(D.copy(addressInfo))
        }
      })
      txInfo.outputs.filter(output => output.isMine).forEach(output => {
        let addressInfo = this.addressInfos.find(a => output.address === a.address)
        if (!selfAddressInfos.includes(addressInfo)) {
          selfAddressInfos.push(D.copy(addressInfo))
        }
      })
      // add txId to selfAddressInfos
      selfAddressInfos.forEach(addressInfo => {
        if (!addressInfo.txs.includes(txInfo.txId)) {
          addressInfo.txs.push(txInfo.txId)
        }
      })
      for (let addressInfo of selfAddressInfos) {
        await this._handleNewTx(addressInfo, txInfo)
      }
    }

    this._addressListener = async (error, addressInfo, txInfo, removedTxId) => {
      if (error !== D.error.succeed) {
        console.warn('BtcAccount addressListener', error)
        return
      }

      addressInfo = D.copy(addressInfo)
      txInfo = D.copy(txInfo)
      if (removedTxId) {
        await this._handleRemovedTx(addressInfo, removedTxId)
        return
      }
      await this._handleNewTx(addressInfo, txInfo)
    }
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = (await this._coinData.getTxInfos({accountId})).txInfos
    this.utxos = await this._coinData.getUtxos({accountId})
  }

  async sync (firstSync = false, offlineMode = false) {
    if (!offlineMode) {
      await this._checkAddressIndexAndGenerateNew(true)
    }

    let checkAddressInfos = D.copy(this.addressInfos)
    while (true) {
      // find out all the transactions
      let blobs = await this._coinData.checkAddresses(this.coinType, checkAddressInfos)
      let responses = await Promise.all(blobs.map(blob => {
        if (blob.removedTxId) {
          let removedTxInfo = this.txInfos.find(txInfo => txInfo.txId === blob.removedTxId)
          // let the txListener handle the overTime pending tx
          if (removedTxInfo && removedTxInfo.confirmations !== D.tx.confirmation.pending) {
            return this._handleRemovedTx(blob.addressInfo, blob.removedTxId)
          }
        } else {
          return this._handleNewTx(blob.addressInfo, blob.txInfo)
        }
      }))

      if (offlineMode) break
      if (responses.length === 0) break
      checkAddressInfos = D.copy(await this._checkAddressIndexAndGenerateNew(true))
    }

    if (firstSync) {
      let listenAddressInfo = this._getAddressInfos(
        this.externalPublicKeyIndex, this.externalPublicKeyIndex + 1, D.address.external)[0]
      if (listenAddressInfo && !this._listenedAddresses.includes(listenAddressInfo.address)) {
        this._listenedAddresses.push(listenAddressInfo.address)
        this._coinData.listenAddresses(this.coinType, [D.copy(listenAddressInfo)], this._addressListener)
      }
      this.txInfos
        .filter(txInfo => txInfo.confirmations !== D.tx.confirmation.dropped)
        .filter(txInfo => txInfo.confirmations < D.tx.getMatureConfirms(this.coinType))
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

  async updateTxComment (txInfo) {
    let oldTxInfo = this.txInfos.find(t => (t.txId === txInfo.txId) && (t.accountId === txInfo.accountId))
    if (!oldTxInfo) {
      console.warn('this txInfo not in the list', txInfo)
      throw D.error.unknown
    }
    await this._coinData.updateTxComment(txInfo)
    oldTxInfo.comment = txInfo.comment
  }

  async _handleRemovedTx (addressInfo, removedTxId) {
    console.warn('btc removed txId', removedTxId)
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
    console.log('btc removed txInfo', removedTxInfo)

    removedTxInfo.confirmations = D.tx.confirmation.dropped
    let oldAddressInfo = this.addressInfos.find(a => a.address === addressInfo.address)
    oldAddressInfo.txs = oldAddressInfo.txs.filter(txId => txId !== removedTxId)

    let removeUtxos = this.utxos.filter(utxo => utxo.txId === removedTxId)
    this.utxos = this.utxos.filter(utxo => !removeUtxos.some(u => u.txId === utxo.txId))

    let updateUtxos = []
    removedTxInfo.inputs.forEach(input => {
      if (!input.isMine) return
      let revertUtxo = this.utxos.find(utxo => (input.prevTxId === utxo.txId) && (input.prevOutIndex === utxo.index))
      revertUtxo.status = D.utxo.status.unspent
      updateUtxos.push(revertUtxo)
    })

    this.balance = this.utxos
      .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
      .reduce((sum, utxo) => sum + utxo.value, 0)
      .toString()

    await this._coinData.removeTx(this._toAccountInfo(), D.copy(oldAddressInfo),
      D.copy(removedTxInfo), D.copy(updateUtxos), D.copy(removeUtxos))
    this.busy = false
  }

  /**
   * handle new transaction
   * update txInfo, find out new transaction and utxos for specific address
   */
  async _handleNewTx (addressInfo, txInfo) {
    console.log('btc newTransaction', addressInfo, txInfo)

    // async operation may lead to disorder. so we need a simple lock
    // eslint-disable-next-line
    while (this.busy) {
      await D.wait(2)
    }
    this.busy = true

    // update txInfo
    txInfo.inputs.forEach(input => {
      input['isMine'] = this.addressInfos.some(a => a.address === input.prevAddress)
    })
    txInfo.outputs.forEach(output => {
      output['isMine'] = this.addressInfos.some(a => a.address === output.address)
    })
    let value = 0
    value -= txInfo.inputs.reduce((sum, input) => sum + (input.isMine ? input.value : 0), 0)
    value += txInfo.outputs.reduce((sum, output) => sum + (output.isMine ? output.value : 0), 0)
    txInfo.value = value.toString()

    let fee = 0
    fee += txInfo.inputs.reduce((sum, input) => sum + input.value, 0)
    fee -= txInfo.outputs.reduce((sum, output) => sum + output.value, 0)
    txInfo.fee = fee.toString()

    let input = txInfo.inputs.find(input => input.isMine)
    txInfo.direction = input ? D.tx.direction.out : D.tx.direction.in
    txInfo.showAddresses = txInfo.direction === D.tx.direction.in
      ? txInfo.inputs.filter(input => !input.isMine).map(input => input.prevAddress)
      : txInfo.outputs.filter(output => !output.isMine).map(output => output.address)
    if (txInfo.showAddresses.length === 0) txInfo.showAddresses.push('self')

    // find out utxos for address
    let utxos = []
    let unspentOutputs = txInfo.outputs.filter(output => addressInfo.address === output.address)
    let unspentUtxos = unspentOutputs.map(output => {
      return {
        accountId: addressInfo.accountId,
        coinType: addressInfo.coinType,
        address: addressInfo.address,
        path: addressInfo.path,
        txId: txInfo.txId,
        index: output.index,
        script: output.script,
        value: output.value,
        status: txInfo.confirmations === D.tx.confirmation.inMemory ? D.utxo.status.unspent_pending : D.utxo.status.unspent
      }
    })
    utxos.push(...unspentUtxos)

    let spentInputs = txInfo.inputs.filter(input => addressInfo.address === input.prevAddress)
    if (spentInputs.length > 0) {
      let spentUtxos = spentInputs.map(input => {
        return {
          accountId: addressInfo.accountId,
          coinType: addressInfo.coinType,
          address: addressInfo.address,
          path: addressInfo.path,
          txId: input.prevTxId,
          index: input.prevOutIndex,
          script: input.prevOutScript,
          value: input.value,
          status: txInfo.confirmations === D.tx.confirmation.inMemory ? D.utxo.status.spent_pending : D.utxo.status.spent
        }
      })
      utxos.push(...spentUtxos)
    }
    await this._handleNewTxInner(addressInfo, txInfo, utxos)

    this.busy = false
  }

  /**
   * handle new transaction
   * update account, store utxo, addressInfo, txInfo
   */
  async _handleNewTxInner (addressInfo, txInfo, utxos) {
    console.log('newTransaction, utxos', addressInfo, txInfo, utxos)

    while (this.innerBusy) {
      await D.wait(2)
    }
    this.innerBusy = true

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
      txInfo.comment = ''
      this.txInfos.push(txInfo)
    } else {
      txInfo.comment = this.txInfos[index].comment
      this.txInfos[index] = txInfo
    }
    this.utxos = this.utxos
      .filter(oldUtxo => !utxos.some(utxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index))
      .concat(utxos)
    let oldAddressInfo = this.addressInfos.find(a => a.address === addressInfo.address)
    oldAddressInfo.txs = D.copy(addressInfo.txs)

    this.balance = this.utxos
      .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
      .reduce((sum, utxo) => sum + utxo.value, 0)
      .toString()

    // update and addressIndex and listen new address
    let newIndex = addressInfo.index + 1
    if (addressInfo.type === D.address.external) {
      if (this.externalPublicKeyIndex < newIndex) this.externalPublicKeyIndex = newIndex
    } else {
      if (this.changePublicKeyIndex < newIndex) this.changePublicKeyIndex = newIndex
    }
    await this._coinData.newTx(this._toAccountInfo(), D.copy(oldAddressInfo), txInfo, utxos)

    if (txInfo.confirmations < D.tx.getMatureConfirms(this.coinType)) {
      if (!this._listenedTxs.some(tx => tx === txInfo.txId)) {
        this._listenedTxs.push(txInfo.txId)
        this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
      }
    }

    this.innerBusy = false
    return {addressInfo, txInfo, utxos}
  }

  /**
   * check address index and genreate new necessary addressInfos
   * @private
   */
  async _checkAddressIndexAndGenerateNew (sync = false) {
    const maxAddressIndexLength = sync ? 20 : 1
    let checkAndGenerate = async (type) => {
      let maxIndex = this.addressInfos.filter(addressInfo => addressInfo.type === type)
        .reduce((max, addressInfo) => Math.max(max, addressInfo.index), -1)
      let nextIndex = maxIndex + 1

      let isExternal = type === D.address.external
      let newNextIndex = isExternal ? this.externalPublicKeyIndex : this.changePublicKeyIndex
      newNextIndex += maxAddressIndexLength
      if (newNextIndex <= nextIndex) {
        return []
      }

      console.log(this.accountId, 'generating', type, 'addressInfos, from', nextIndex, 'to', newNextIndex)
      let addressInfos = []
      for (let i = nextIndex; i < newNextIndex; i++) {
        let address = await this._device.getAddress(this.coinType, D.makeBip44Path(this.coinType, this.index, type, i))
        addressInfos.push({
          address: address,
          accountId: this.accountId,
          coinType: this.coinType,
          path: D.makeBip44Path(this.coinType, this.index, type, i),
          type: type,
          index: i,
          txs: []
        })
      }
      return addressInfos
    }

    let newAddressInfos = [].concat(
      await checkAndGenerate(D.address.external),
      await checkAndGenerate(D.address.change))
    await this._coinData.newAddressInfos(this._toAccountInfo(), D.copy(newAddressInfos))
    this.addressInfos.push(...newAddressInfos)
    return newAddressInfos
  }

  _getAddressInfos (startIndex, stopIndex, type, copy = true) {
    let addressInfos = this.addressInfos.filter(
      a => a.type === type && a.index >= startIndex && a.index < stopIndex)
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

  async getTxInfos (startIndex, endIndex) {
    let accountId = this.accountId
    return this._coinData.getTxInfos({accountId, startIndex, endIndex})
  }

  async getAddress (isStoring = false) {
    let address = await this._device.getAddress(this.coinType,
      D.makeBip44Path(this.coinType, this.index, D.address.external, this.externalPublicKeyIndex),
      true, isStoring)

    await this._checkAddressIndexAndGenerateNew()
    let listenAddressInfo = this._getAddressInfos(
      this.externalPublicKeyIndex, this.externalPublicKeyIndex + 1, D.address.external)[0]
    if (listenAddressInfo && !this._listenedAddresses.includes(listenAddressInfo.address)) {
      this._listenedAddresses.push(listenAddressInfo.address)
      this._coinData.listenAddresses(this.coinType, [D.copy(listenAddressInfo)], this._addressListener)
    }

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
   *   oldTxId: string, // resend mode only
   *   feeRate: string (satoshi),
   *   outputs: [{
   *     address: base58 string,
   *     value: string (satoshi)
   *   }],
   *   comment: string (optional)
   * }
   * @returns {Promise<prepareTx>}
   * {
   *   total: number (satoshi)
   *   fee: number (satoshi)
   *   feeRate: number (satoshi),
   *   utxos: utxo array,
   *   outputs: [{
   *     address: base58 string,
   *     value: number (satoshi)
   *   }],
   *   deviceLimit: bool
   * }
   */
  async prepareTx (details) {
    console.log('prepareTx details', details)

    if (!D.isBtc(this.coinType)) throw D.error.coinNotSupported
    if (D.isDecimal(details.feeRate)) throw D.error.valueIsDecimal
    details.outputs.forEach(output => {
      if (D.isDecimal(output.value)) throw D.error.valueIsDecimal
    })

    details = D.copy(details)
    details.feeRate = Number(details.feeRate)
    details.outputs.forEach(output => {
      output.value = Number(output.value)
    })

    let utxos = this.utxos
      .filter(utxo => utxo.status === D.utxo.status.unspent ||
        utxo.status === D.utxo.status.unspent_pending)
      .filter(utxo => utxo.value > 0)
      .map(utxo => D.copy(utxo))

    let oldUtxos = []
    if (details.oldTxId) {
      let oldTxInfo = this.txInfos.find(txInfo => txInfo.txId === details.oldTxId)
      if (!oldTxInfo) {
        console.warn('oldTxId not found in history')
        throw D.error.unknown
      }

      oldTxInfo.inputs.forEach(input => {
        let oldUtxo = this.utxos.find(
          utxo => utxo.txId === input.prevTxId && utxo.index === input.prevOutIndex)
        if (!oldUtxo) {
          console.warn('oldUtxo not found in history', input)
          throw D.error.unknown
        }
        oldUtxos.push(oldUtxo)
      })
      utxos = utxos.filter(utxo => !oldUtxos.some(
        u => u.txId === utxo.txId && u.index === utxo.index))
    }

    let proposal = BtcCoinSelect.getEnoughUtxo(
      utxos, oldUtxos, details.outputs, details.feeRate, details.sendAll)
    let totalOut = proposal.willSpentUtxos.reduce((sum, utxo) => utxo.value + sum, 0)
    // reset the output[0].value if this two flags = true
    if (details.sendAll || proposal.deviceLimit) {
      details.outputs[0].value = totalOut - proposal.fee
    }

    return {
      feeRate: details.feeRate,
      outputs: details.outputs,
      fee: proposal.fee,
      total: totalOut,
      utxos: proposal.willSpentUtxos,
      comment: details.comment || '',
      // deviceLimit = true means device can not carry more utxos to sign, this is the largest value that device can sent
      deviceLimit: proposal.deviceLimit
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

    let rawTx = {
      inputs: D.copy(prepareTx.utxos),
      outputs: D.copy(prepareTx.outputs),
      changePath: null
    }

    let changeValue = totalIn - prepareTx.total
    let changeAddressInfo
    if (changeValue !== 0) {
      changeAddressInfo = this.addressInfos.find(addressInfo => {
        return addressInfo.type === D.address.change &&
          addressInfo.index === this.changePublicKeyIndex
      })
      rawTx.outputs.push({address: changeAddressInfo.address, value: changeValue})
      rawTx.changePath = changeAddressInfo.path
    }

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
      value: '-' + prepareTx.total.toString(),
      fee: prepareTx.fee.toString(),
      showAddresses: prepareTx.outputs.map(output => output.address),
      inputs: prepareTx.utxos.map(utxo => {
        return {
          prevAddress: utxo.address,
          prevTxId: utxo.txId,
          prevOutIndex: utxo.index,
          prevOutScript: utxo.script,
          isMine: true,
          value: utxo.value
        }
      }),
      outputs: rawTx.outputs.map((output, index) => {
        return {
          address: output.address,
          isMine: output.address === (changeAddressInfo && changeAddressInfo.address),
          index: index,
          script: D.address.makeOutputScript(output.address),
          value: output.value
        }
      }),
      comment: prepareTx.comment
    }

    // update utxo spent status from unspent to spent pending
    prepareTx.utxos.forEach(utxo => { utxo.status = D.utxo.status.spent_pending })

    // add change utxo if exist
    if (changeValue !== 0) {
      let changeOutput = txInfo.outputs[txInfo.outputs.length - 1]
      let changeAddressBuffer = D.address.toBuffer(changeAddressInfo.address)
      let changeUtxo = {
        accountId: this.accountId,
        coinType: this.coinType,
        address: changeOutput.address,
        path: changeAddressInfo.path,
        txId: txInfo.txId,
        index: txInfo.outputs.length - 1,
        value: changeValue,
        status: D.utxo.status.unspent_pending,
        // P2PKH script
        script: '76a914' + changeAddressBuffer.toString('hex') + '88ac'
      }
      prepareTx.utxos.push(changeUtxo)
    }

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
    Object.values(blobs).forEach(blob => this._handleNewTxInner(blob.addressInfo, signedTx.txInfo, blob.utxos))
  }
}
