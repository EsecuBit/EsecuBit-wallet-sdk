
import D from './D'

export default class BtcAccount {
  constructor (info, device, coinData) {
    let assign = () => {
      this.accountId = info.accountId
      this.label = info.label
      this.coinType = info.coinType
      this.index = info.index
      this.balance = info.balance
      this.externalPublicKey = info.externalPublicKey
      this.externalPublicKeyIndex = info.externalPublicKeyIndex
      this.changePublicKey = info.changePublicKey
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
      console.log('newTransaction', addressInfo, addressInfo, txInfo, utxos)
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

  // TODO judge compress uncompress public key
  async sync () {
    let newAddressInfos = await this._checkAddressIndexAndGenerateNew(true)
    await this._coinData.newAddressInfos(this._toAccountInfo(), newAddressInfos)

    let checkAddressInfos = this.addressInfos
    while (true) {
      // find out all the transactions
      let blobs = await this._coinData.checkAddresses(this.coinType, checkAddressInfos)
      let responses = await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos, true)))
      // no new transactions, sync finish
      if (responses.length === 0) break
      checkAddressInfos = responses.reduce((array, response) => array.concat(response.newAddressInfos), [])
    }
    // TODO listen external address only
    let listenAddressInfos = [].concat(
      this._getAddressInfos(0, this.externalPublicKeyIndex + 1, D.address.external),
      this._getAddressInfos(0, this.changePublicKeyIndex + 1, D.address.change))
    if (listenAddressInfos.length !== 0) this._coinData.listenAddresses(this.coinType, listenAddressInfos, this._addressListener)

    this.txInfos.filter(txInfo => txInfo.confirmations < D.tx.matureConfirms.btc)
      .forEach(txInfo => {
        this._listenedTxs.push(txInfo.txId)
        this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
      })
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

    // check utxo update. unspent can update to pending and spent, pending can update to spent. otherwise ignore
    utxos = utxos.filter(utxo => {
      let oldUtxo = this.utxos.find(oldUtxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index)
      if (!oldUtxo) return true
      if (oldUtxo.spent === D.utxo.status.unspent) return true
      if (oldUtxo.spent === D.utxo.status.pending) return utxo === D.utxo.status.spent
      return false
    })

    // update account info
    this.balance += txInfo.value
    this.txInfos.push(D.copy(txInfo))
    this.utxos.push(...utxos)

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
    if (txInfo.confirmations < D.tx.matureConfirms.btc) {
      console.log('listen transaction status', txInfo)
      if (!this._listenedTxs.some(tx => tx === txInfo.txId)) {
        this._listenedTxs.push(txInfo.txId)
        this._coinData.listenTx(this.coinType, D.copy(txInfo), this._txListener)
      }
    }

    this.busy = false
    return {addressInfo, txInfo, utxos, newAddressInfos}
  }

  /**
   * check address index and genreate new necessary addressInfos
   * @private
   */
  async _checkAddressIndexAndGenerateNew (sync = false) {
    let checkAndGenerate = async (type) => {
      let isExternal = type === D.address.external
      let publicKey = isExternal ? this.externalPublicKey : this.changePublicKey
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
        try {
          let address = await this._device.getAddress(this.coinType, i, publicKey)
          return {
            address: address,
            accountId: this.accountId,
            coinType: this.coinType,
            path: D.makeBip44Path(this.coinType, this.index, type, i),
            type: type,
            index: i,
            txs: []
          }
        } catch (e) {
          if (e === D.error.device_derive_larger_than_n) return null
          throw e
        }
      }))).filter(addressInfo => addressInfo !== null)
    }

    if (!this.externalPublicKey) {
      let externalPath = D.makeBip44Path(this.coinType, this.index, D.address.external)
      this.externalPublicKey = await this._device.getPublicKey(externalPath)
      this.externalPublicKeyIndex = 0
    }

    if (!this.changePublicKey) {
      let changePath = D.makeBip44Path(this.coinType, this.index, D.address.change)
      this.changePublicKey = await this._device.getPublicKey(changePath)
      this.changePublicKeyIndex = 0
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
      externalPublicKey: this.externalPublicKey,
      externalPublicKeyIndex: this.externalPublicKeyIndex,
      changePublicKey: this.changePublicKey,
      changePublicKeyIndex: this.changePublicKeyIndex
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
    let address = await this._getAddressFromDeviceRetry(D.address.external)
    let prefix
    switch (this.coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
        prefix = 'bitcoin:'
        break
      default:
        throw D.error.coin_not_supported
    }
    return {address: address, qrAddress: prefix + address}
  }

  /**
   * get address from device, and update public key index
   * index + 1 and retry when got error.deviceDeriveLargerThanN
   */
  async _getAddressFromDeviceRetry (type) {
    let publicKey = type === D.address.external ? this.externalPublicKey : this.changePublicKey
    let index = type === D.address.external ? this.externalPublicKeyIndex : this.changePublicKeyIndex
    let address
    while (true) {
      try {
        address = await this._device.getAddress(this.coinType, index, publicKey)
      } catch (e) {
        if (e === D.error.deviceDeriveLargerThanN) {
          index++
          console.warn('derived key larger than n, try next', index)
          continue
        }
        throw e
      }
      break
    }
    return address
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
    let totalOut = prepareTx.outputs.reduce((sum, output) => sum + output.value, 0)
    if (totalOut + prepareTx.fee !== prepareTx.total) throw D.error.unknown
    let totalIn = prepareTx.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    if (totalIn < prepareTx.total) throw D.error.txNotEnoughValue

    let changeAddress = await this._getAddressFromDeviceRetry(D.address.change)
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
    // broadcast transaction to network
    if (!test) await this._coinData.sendTx(this._toAccountInfo(), signedTx.utxos, signedTx.txInfo, signedTx.hex)
    // change utxo spent status from unspent to spent pending
    signedTx.utxos.forEach(utxo => { utxo.spent = D.utxo.status.pending })
    signedTx.utxos.map(utxo => {
      let addressInfo = this.addressInfos.find(addressInfo => addressInfo.address === utxo.address)
      return {addressInfo, utxo}
    }).forEach(pair => this._handleNewTx(pair.addressInfo, signedTx.txInfo, [pair.utxo]))
  }

  /**
   * @deprecated
   */
  sendBitCoin (transaction, callback) {
    let enc = new TextEncoder()
    console.dir(enc)

    let total = transaction.out + transaction.fee
    let totalString = D.convertValue(this.coinType, total, D.unit.btc.santoshi, D.unit.btc.BTC) + ' btc.BTC'
    let apdu = ''
    let hexChars = '0123456789ABCDEF'
    apdu += hexChars[totalString.length >> 4] + hexChars[totalString.length % 0x10] + D.arrayBufferToHex(enc.encode(totalString))
    console.log(apdu)
    apdu += '01'
    console.log(apdu)
    apdu += hexChars[transaction.addresses[0].length >> 4] + hexChars[transaction.addresses[0].length % 0x10] + D.arrayBufferToHex(enc.encode(transaction.addresses[0]))
    console.log(apdu)
    apdu = hexChars[parseInt(apdu.length / 2) % 0x10] + apdu
    apdu = hexChars[parseInt(apdu.length / 2) >> 4] + apdu
    apdu = '00780000' + apdu
    console.log(apdu)

    // var ok = "007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138"
    let response = this._device.sendHexApduTrue(apdu, callback)
    let data = new Uint8Array(response)
    let intArray = new Uint8Array(new Array(2))
    intArray[0] = data[3]
    intArray[1] = data[4]
    console.log('data ' + D.arrayBufferToHex(response))
    console.log('data ' + D.arrayBufferToHex(data))
    console.log('sw ' + D.arrayBufferToHex(intArray))
    let sw = D.arrayBufferToHex(intArray)

    if (sw === '6FFA') {
      this._device.sendBitCoin(transaction, callback)
    }
    callback(sw === '9000' ? D.error.succeed : D.error.userCancel)
  }
}
