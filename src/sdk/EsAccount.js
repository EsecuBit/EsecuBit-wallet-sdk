
import D from './D'
import CoinData from './data/CoinData'

// TODO surrounded with try catch
export default class EsAccount {
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

    this._txListener = async (error, txInfo) => {
      if (error !== D.ERROR_NO_ERROR) {
        return
      }
      await this._coinData.saveOrUpdateTxInfo(txInfo)
    }

    this._addressListener = async (error, addressInfo, txInfo, utxos) => {
      if (error !== D.ERROR_NO_ERROR) {
        this._listeners.forEach(listener => listener(error, txInfo))
        return
      }

      let accounts = await this._db.getAccounts({accountId: addressInfo.accountId})
      let account = accounts[0]
      let response = await this._handleNewTx(account, addressInfo, txInfo, utxos)
      await this._device.updateIndex(this)
      await this._coinData.newTx(this.toAccountInfo(), addressInfo, txInfo, utxos)
      // this._network[account.coinType].listenAddresses(newAddressInfos.slice(oldIndex, newIndex), this._addressListener)
      // this._listeners.forEach(listener => listener(D.ERROR_NO_ERROR, txInfo, account))
    }
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = await this._coinData.getTxInfos({accountId})
    this.utxos = await this._coinData.getUtxos({accountId})
  }

  async sync () {
    await this._checkAddressIndexAndGenerateNew()

    while (true) {
      // find out all the transactions
      let blobs = await this._coinData.checkAddresses(this.addressInfos)
      let responses = await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos, true)))
      // no new transactions, sync finish
      if (responses.length === 0) break
      let newAddressInfos = responses.reduce((array, response) => array.concat(response.newAddressInfos), [])
      this._coinData.listenAddresses(newAddressInfos, this._addressListener)
    }

    // let addressInfos = await this._db.getAddressInfos({coinType: coinType, type: D.ADDRESS_EXTERNAL})
    // network.listenAddresses(addressInfos, this._addressListener)
  }

  delete () {
    return this._coinData.deleteAccount(this.toAccountInfo())
  }

  async save () {
    // TODO
  }

  /**
   * handle when new transaction comes:
   * 1. store/update new txInfo after filling "isMine" and "value" field
   * 2. store utxo, addressInfo, txInfo
   */
  async _handleNewTx (addressInfo, txInfo, utxos, isSyncing = false) {
    // eslint-disable-next-line
    // TODO remove?
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true
    txInfo.inputs.forEach(input => { input['isMine'] = this.addressInfos.some(a => a.address === input.prevAddress) })
    txInfo.outputs.forEach(output => { output['isMine'] = this.addressInfos.some(a => a.address === output.address) })
    txInfo.value = 0
    txInfo.value -= txInfo.inputs.reduce((sum, input) => sum + input.isMine ? input.value : 0, 0)
    txInfo.value += txInfo.outputs.reduce((sum, output) => sum + output.isMine ? output.value : 0, 0)

    // update account balance
    this.balance += txInfo.value

    // update and addressIndex and listen new address
    let addressPath = D.parseBip44Path(addressInfo.path)
    let newIndex = addressPath.addressIndex + 1
    addressPath.isExternal ? this.externalPublicKeyIndex = newIndex : this.changePublicKeyIndex = newIndex
    let newAddressInfos = await this._checkAddressIndexAndGenerateNew()
    console.info('account index update', this, 'external', addressPath.isExternal, 'new index', this.externalPublicKeyIndex, 'new address', newAddressInfos)

    // check utxo update. unspent can update to pending and spent, pending can update to spent. otherwise ignore
    utxos.filter(utxo => {
      let oldUtxo = this.utxos.find(oldUtxo => oldUtxo.txId === utxo.txId && oldUtxo.index === utxo.index)
      if (!oldUtxo) return true
      if (oldUtxo.spent === D.TX_UNSPENT) return true
      if (oldUtxo.spent === D.TX_SPENT_PENDING) return utxo === D.TX_SPENT
      return false
    })
    this.utxos.concat(utxos)

    await this._device.updateIndex(this)
    await this._coinData.newTx(this.toAccountInfo(), addressInfo, txInfo, utxos)
    // TODO
    // this._network[account.coinType].listenAddresses(newAddressInfos.slice(oldIndex, newIndex), this._addressListener)
    this.busy = false
    return {addressInfo, txInfo, utxos, newAddressInfos}
  }

  /**
   * check address index and genreate new necessary addressInfos
   * @private
   */
  _checkAddressIndexAndGenerateNew () {
    let checkAndGenerate = (isExternal) => {
      let path = D.makeBip44Path(this.coinType, this.index, isExternal)
      let publicKey = isExternal ? this.externalPublicKey : this.changePublicKey
      let index = isExternal ? this.externalPublicKeyIndex : this.changePublicKeyIndex
      let maxChangeIndex = this.addressInfos.reduce((max, addressInfo) => {
        let addressPath = D.parseBip44Path(addressInfo.path)
        return Math.max(max, addressPath.isExternal ? -1 : addressInfo.addressIndex)
      }, -1)
      return Promise.all(Array.from({length: index + 19 - maxChangeIndex}, (v, k) => k).map(async k => {
        let address = await this._device.getAddress(k, publicKey)
        return {
          address: address,
          accountId: this.accountId,
          coinType: this.coinType,
          path: path + '/' + k,
          type: D.ADDRESS_EXTERNAL,
          txs: []
        }
      }))
    }
    return [].concat(checkAndGenerate(true), checkAndGenerate(false))
  }

  toAccountInfo () {
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
    return this.txInfos.slice(startIndex, endIndex)
  }

  async getAddress () {
    let address = await this._device.getAddress(this.externalPublicKeyIndex, this.externalPublicKey)
    let prefix
    switch (this.coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
        prefix = 'bitcoin:'
        break
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }
    return {address: address, qrAddress: prefix + address}
  }

  /**
   *
   * @param details
   * {
   *   feeRate: long (bitcoin -> santoshi) per byte,
   *   outputs: [{
   *     address: base58 string,
   *     value: long (bitcoin -> santoshi)
   *   }]
   * }
   * @returns {Promise<prepareTx>}
   * {
   *   total: long (bitcoin -> santoshi)
   *   fee: long (bitcoin -> santoshi)
   *   feeRate: long (bitcoin -> santoshi) per byte,
   *   utxos: utxo array,
   *   outputs: [{
   *     address: base58 string,
   *     value: long (bitcoin -> santoshi)
   *   }]
   * }
   */
  async prepareTx (details) {
    if (this.coinType !== D.COIN_BIT_COIN && this.coinType !== D.COIN_BIT_COIN_TEST) throw D.ERROR_COIN_NOT_SUPPORTED

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
        throw D.ERROR_TX_NOT_ENOUGH_VALUE
      }
      return {newTotal, willSpentUtxos}
    }

    let utxos = await this._coinData.getUtxos({accountId: this.accountId, spent: D.TX_UNSPENT})
    let total = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    let fee = details.feeRate
    let totalOut = details.outputs.reduce((sum, output) => sum + output.value, 0)
    // calculate the fee using uncompressed public key
    let calculateFee = (utxos, outputs) => (utxos.length * 180 + 34 * outputs.length + 34 + 10) * details.feeRate
    let result
    while (true) {
      if (total < fee + totalOut) throw D.ERROR_TX_NOT_ENOUGH_VALUE
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
    if (totalOut + prepareTx.fee !== prepareTx.total) throw D.ERROR_UNKNOWN
    let totalIn = prepareTx.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    if (totalIn < prepareTx.total) throw D.ERROR_TX_NOT_ENOUGH_VALUE

    let changeAddress = await this._device.getAddress(this.changePublicKeyIndex, this.changePublicKey)
    let value = totalIn - prepareTx.total
    let rawTx = {
      inputs: prepareTx.utxos,
      outputs: prepareTx.outputs
    }
    rawTx.outputs.push({address: changeAddress, value: value})
    console.info(rawTx)
    let signedTx = await this._device.signTransaction(rawTx)
    let txInfo = {
      accountId: this.accountId,
      coinType: this.coinType,
      txId: signedTx.id,
      version: 1,
      blockNumber: -1,
      confirmations: -1,
      time: new Date().getTime(),
      direction: D.TX_DIRECTION_OUT,
      inputs: prepareTx.utxos.map(utxo => {
        return {
          prevAddress: utxo.address,
          isMine: true,
          value: utxo.value
        }
      }),
      // TODO output has self address
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
   * @returns {Promise<void>}
   * @see buildTx
   */
  async sendTx (signedTx) {
    await this._coinData.sendTx(this.toAccountInfo(), signedTx.utxos, signedTx.txInfo, signedTx.hex)
    // TODO
    // let addressInfos = await this._db.getAddressInfos({accountId: account.accountId})
    // utxos.map(utxo => {
    //   let addressInfo = addressInfos.find(addressInfo => addressInfo.address === utxo.address)
    //   return {addressInfo, utxo}
    // }).forEach(pair => this._newTx(account, pair.addressInfo, txInfo, pair.utxo))
  }

  sendBitCoin (transaction, callback) {
    let enc = new TextEncoder()
    console.dir(enc)

    let total = transaction.out + transaction.fee
    let totalString = CoinData.getFloatFee(total) + ' BTC'
    let apdu = ''
    let hexChars = '0123456789ABCDEF'
    apdu += hexChars[totalString.length >> 4] + hexChars[totalString.length % 0x10] + D.arrayBufferToHex(enc.encode(totalString))
    console.info(apdu)
    apdu += '01'
    console.info(apdu)
    apdu += hexChars[transaction.addresses[0].length >> 4] + hexChars[transaction.addresses[0].length % 0x10] + D.arrayBufferToHex(enc.encode(transaction.addresses[0]))
    console.info(apdu)
    apdu = hexChars[parseInt(apdu.length / 2) % 0x10] + apdu
    apdu = hexChars[parseInt(apdu.length / 2) >> 4] + apdu
    apdu = '00780000' + apdu
    console.info(apdu)

    // var ok = "007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138"
    let response = this._device.sendHexApduTrue(apdu, callback)
    let data = new Uint8Array(response)
    let intArray = new Uint8Array(new Array(2))
    intArray[0] = data[3]
    intArray[1] = data[4]
    console.info('data ' + D.arrayBufferToHex(response))
    console.info('data ' + D.arrayBufferToHex(data))
    console.info('sw ' + D.arrayBufferToHex(intArray))
    let sw = D.arrayBufferToHex(intArray)

    if (sw === '6FFA') {
      this._device.sendBitCoin(transaction, callback)
    }
    callback(sw === '9000' ? D.ERROR_NO_ERROR : D.ERROR_USER_CANCEL)
  }
}
