
import D from '../D'
import BtcCoinSelect from './BtcCoinSelect'
import IAccount from './IAccount'

export default class BtcAccount extends IAccount {
  async _handleRemovedTx (removedTxId) {
    console.warn('btc removed txId', removedTxId)
    // async operation may lead to disorder. so we need a simple lock
    while (this._busy) {
      await D.wait(2)
    }
    this._busy = true
    try {
      // update removed txInfo
      let removedTxInfo = this.txInfos.find(txInfo => txInfo.txId === removedTxId)
      if (!removedTxInfo) {
        console.warn(this.accountId, 'removed txId not found', removedTxId)
        return
      }
      console.log('btc removed txInfo', removedTxInfo)
      removedTxInfo.confirmations = D.tx.confirmation.dropped

      // update addressInfos
      let addressInfos = this.addressInfos.filter(
        addressInfo => addressInfo.txs.includes(removedTxId))
      for (let addressInfo of addressInfos) {
        let oldAddressInfo = this.addressInfos.find(a => a.address === addressInfo.address)
        oldAddressInfo.txs = oldAddressInfo.txs.filter(txId => txId !== removedTxId)
      }

      // remove utxos come from this tx
      let removeUtxos = this.utxos.filter(utxo => utxo.txId === removedTxId)
      this.utxos = this.utxos.filter(utxo => !removeUtxos.some(u => u.txId === utxo.txId))

      // revert utxos using by this tx
      let updateUtxos = []
      removedTxInfo.inputs.forEach(input => {
        if (!input.isMine) return
        let revertUtxo = this.utxos.find(utxo => (input.prevTxId === utxo.txId) && (input.prevOutIndex === utxo.index))
        if (!revertUtxo) {
          console.warn('revertUtxo not found', input)
          return
        }

        // the spent utxo may be reused again before detected(e.g. resend tx), we need to check
        let reusedTxInfo = this.txInfos.filter(txInfo =>
          txInfo.confirmations !== D.tx.confirmation.dropped &&
          txInfo.inputs.some(i =>
            i.prevAddress === input.prevAddress &&
            i.prevOutIndex === input.prevOutIndex))
        if (reusedTxInfo) {
          console.log('utxo has been reused', input, removedTxInfo)
        } else {
          revertUtxo.status = D.utxo.status.unspent
          updateUtxos.push(revertUtxo)
        }
      })

      this.balance = this.utxos
        .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
        .reduce((sum, utxo) => sum + utxo.value, 0)
        .toString()

      await this._coinData.removeTx(this._toAccountInfo(), D.copy(addressInfos),
        D.copy(removedTxInfo), D.copy(updateUtxos), D.copy(removeUtxos))
    } catch (e) {
      console.warn('_handleRemovedTx error', e)
      throw e
    } finally {
      this._busy = false
    }
  }

  /**
   * handle new transaction
   * complete txInfo, generate utxos
   */
  async _handleNewTx (txInfo) {
    console.log('btc newTransaction', txInfo)

    // async operation may lead to disorder. so we need a simple lock
    // eslint-disable-next-line
    while (this._busy) {
      await D.wait(2)
    }
    this._busy = true

    try {
      // update txInfo and addressInfos
      txInfo.inputs.forEach(input => {
        input.isMine = this.addressInfos.some(a => a.address === input.prevAddress)
      })
      txInfo.outputs.forEach(output => {
        output.isMine = this.addressInfos.some(a => a.address === output.address)
      })

      // calculate value
      let value = 0
      value -= txInfo.inputs.reduce((sum, input) => sum + (input.isMine ? input.value : 0), 0)
      value += txInfo.outputs.reduce((sum, output) => sum + (output.isMine ? output.value : 0), 0)
      txInfo.value = value.toString()

      // calculate fee
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
      let unspentOutputs = txInfo.outputs.filter(output => output.isMine)
      let unspentUtxos = unspentOutputs.map(output => {
        let addressInfo = this.addressInfos.find(a => a.address === output.address)
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

      let spentInputs = txInfo.inputs.filter(input => input.isMine)
      if (spentInputs.length > 0) {
        let spentUtxos = spentInputs.map(input => {
          let addressInfo = this.addressInfos.find(a => a.address === input.prevAddress)
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
      await this._handleNewTxInner(txInfo, utxos)
    } catch (e) {
      console.warn('_handleNewTx error', e)
      throw e
    } finally {
      this._busy = false
    }
  }

  /**
   * handle new transaction
   * update account, store utxo, addressInfo, txInfo
   */
  async _handleNewTxInner (txInfo, utxos) {
    console.log('btc newTransaction, utxos', txInfo, utxos)

    while (this._innerBusy) {
      await D.wait(2)
    }
    this._innerBusy = true

    try {
      // update account info
      let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
      if (index === -1) {
        txInfo.comment = ''
        this.txInfos.push(txInfo)
      } else {
        txInfo.comment = this.txInfos[index].comment
        this.txInfos[index] = txInfo
      }

      // update utxos
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
      this.utxos = this.utxos
        .filter(oldUtxo => !utxos.some(utxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index))
        .concat(utxos)

      // update balance
      this.balance = this.utxos
        .filter(utxo => utxo.status === D.utxo.status.unspent || utxo.status === D.utxo.status.unspent_pending)
        .reduce((sum, utxo) => sum + utxo.value, 0)
        .toString()

      // update addressInfos
      let relativeAddresses = []
      let maxExternalIndex = this.externalPublicKeyIndex
      let maxChangeIndex = this.changePublicKeyIndex
      txInfo.inputs.filter(input => input.isMine).forEach(input => {
        let addressInfo = this.addressInfos.find(a => a.address === input.prevAddress)
        if (!relativeAddresses.some(a => a.address === addressInfo.address)) {
          relativeAddresses.push(addressInfo)
          if (!addressInfo.txs.includes(txInfo.txId)) {
            addressInfo.txs.push(txInfo.txId)
          }

          if (addressInfo.type === D.address.external) {
            maxExternalIndex = Math.max(maxExternalIndex, addressInfo.index)
          } else {
            maxChangeIndex = Math.max(maxChangeIndex, addressInfo.index)
          }
        }
      })
      txInfo.outputs.filter(input => input.isMine).forEach(output => {
        let addressInfo = this.addressInfos.find(a => a.address === output.address)
        if (!relativeAddresses.some(a => a.address === addressInfo.address)) {
          relativeAddresses.push(addressInfo)
          if (!addressInfo.txs.includes(txInfo.txId)) {
            addressInfo.txs.push(txInfo.txId)
          }

          if (addressInfo.type === D.address.external) {
            maxExternalIndex = Math.max(maxExternalIndex, addressInfo.index + 1)
          } else {
            maxChangeIndex = Math.max(maxChangeIndex, addressInfo.index + 1)
          }
        }
      })

      // update addressIndex
      this.externalPublicKeyIndex = Math.max(maxExternalIndex, this.externalPublicKeyIndex)
      this.changePublicKeyIndex = Math.max(maxChangeIndex, this.changePublicKeyIndex)

      // listen unmatured tx
      await this._coinData.newTx(this._toAccountInfo(), D.copy(relativeAddresses), D.copy(txInfo), D.copy(utxos))

      if (txInfo.confirmations < D.tx.getMatureConfirms(this.coinType)) {
        if (!this._listenedTxs.some(tx => tx === txInfo.txId)) {
          this._listenedTxs.push(txInfo.txId)
          this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
        }
      }
    } catch (e) {
      console.warn('_handleNewTxInner error', e)
      throw e
    } finally {
      this._innerBusy = false
    }
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
        let address = await this._device.getAddress(this.coinType, D.address.path.makeBip44Path(this.coinType, this.index, type, i))
        addressInfos.push({
          address: address,
          accountId: this.accountId,
          coinType: this.coinType,
          path: D.address.path.makeBip44Path(this.coinType, this.index, type, i),
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
    if (newAddressInfos.length > 0) {
      await this._coinData.newAddressInfos(this._toAccountInfo(), D.copy(newAddressInfos))
    }
    this.addressInfos.push(...newAddressInfos)
    return newAddressInfos
  }

  async getAddress (isStoring = false) {
    let address = await this._device.getAddress(this.coinType,
      D.address.path.makeBip44Path(this.coinType, this.index, D.address.external, this.externalPublicKeyIndex),
      true, isStoring)

    await this._checkAddressIndexAndGenerateNew()
    let listenAddressInfo = D.copy(this.addressInfos[this.externalPublicKeyIndex])
    if (listenAddressInfo && !this._listenedAddresses.includes(listenAddressInfo.address)) {
      this._listenedAddresses.push(listenAddressInfo.address)
      this._coinData.listenAddresses(this.coinType, [D.copy(listenAddressInfo)], this._addressListener)
    }

    let prefix = ''
    return {address: address, qrAddress: prefix + address}
  }

  /**
   *
   * @param details
   * {
   *   sendAll: bool,
   *   oldTxId: hex string, // resend mode only
   *   feeRate: decimal integer string / number (satoshi),
   *   outputs: [{
   *     address: base58 string,
   *     value: decimal integer string / number (satoshi)
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
   *   deviceLimit: bool,
   *   oldTxInfo: txInfo // exist if resend
   * }
   */
  async prepareTx (details) {
    console.log('prepareTx details', details)

    if (Number(details.feeRate) === 0) {
      console.warn('fee can not be 0')
      throw D.error.networkFeeTooSmall
    }

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
    let oldTxInfo
    if (details.oldTxId) {
      oldTxInfo = this.txInfos.find(txInfo => txInfo.txId === details.oldTxId)
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

    let proposal = BtcCoinSelect.selectCoinSet(
      utxos, oldUtxos, details.outputs, details.feeRate, details.sendAll)
    let totalUtxos = proposal.willSpentUtxos.reduce((sum, utxo) => utxo.value + sum, 0)
    // reset the output[0].value if this two flags = true
    if (details.sendAll || proposal.deviceLimit) {
      details.outputs[0].value = totalUtxos - proposal.fee
    }
    let totalOut = details.outputs.reduce((sum, output) => sum + output.value, 0)

    let prepareTxData = {
      feeRate: details.feeRate,
      outputs: details.outputs,
      fee: proposal.fee,
      total: totalOut + proposal.fee,
      utxos: proposal.willSpentUtxos,
      comment: details.comment || ''
    }
    if (proposal.deviceLimit) {
      // deviceLimit = true means device can not carry more utxos to sign, this is the largest value that device can sent
      prepareTxData.deviceLimit = proposal.deviceLimit
    }
    if (oldTxInfo) {
      prepareTxData.oldTxInfo = D.copy(oldTxInfo)
    }
    return prepareTxData
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
      await this._checkAddressIndexAndGenerateNew()
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

    return {
      txInfo: txInfo,
      hex: signedTx.hex,
      oldTxInfo: prepareTx.oldTxInfo
    }
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
    if (!test) await this._coinData.sendTx(this.coinType, signedTx.hex)

    if (signedTx.oldTxInfo) {
      await this._handleRemovedTx(signedTx.oldTxInfo.txId)
    }

    await this._handleNewTx(signedTx.txInfo)
  }
}
