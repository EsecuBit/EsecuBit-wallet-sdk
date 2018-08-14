
import D from './D'
import BigInteger from 'bigi'

export default class EthAccount {
  constructor (info, device, coinData) {
    let assign = () => {
      this.accountId = info.accountId
      this.label = info.label
      this.coinType = info.coinType
      this.index = info.index
      this.balance = info.balance
      this.externalPublicKeyIndex = info.externalPublicKeyIndex
    }
    assign()
    this._device = device
    this._coinData = coinData
    this._listenedTxs = []

    this._txListener = async (error, txInfo) => {
      if (error !== D.error.succeed) {
        console.warn('EthAccount txListener', error)
        return
      }
      console.log('newTransaction status', txInfo)
      let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
      if (index === -1) {
        console.warn('this should not happen, add it')
        this.txInfos.push(txInfo)
        index = this.txInfos.length - 1
      } else {
        // only update comfirmations, because txInfo may contains old gas(gasLimit, not gasUsed)
        this.txInfos[index].confirmations = txInfo.confirmations
      }
      await this._handleNewTx(this.addressInfos[0], this.txInfos[index])
    }

    this._addressListener = async (error, addressInfo, txInfo) => {
      if (error !== D.error.succeed) {
        console.warn('EthAccount addressListener', error)
        return
      }
      await this._handleNewTx(addressInfo, txInfo)
    }
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = (await this._coinData.getTxInfos({accountId})).txInfos
  }

  async sync (firstSync = false, offlineMode = false) {
    if (!offlineMode) await this._generateAddressIfNotExist()
    // find out all the transactions
    let blobs = await this._coinData.checkAddresses(this.coinType, this.addressInfos)
    await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos)))
    if (firstSync) {
      this._coinData.listenAddresses(this.coinType, D.copy(this.addressInfos), this._addressListener)
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

  async _generateAddressIfNotExist () {
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

  /**
   * handle when new transaction comes:
   * 1. store/update new txInfo after filling "isMine" and "value" field
   * 2. store utxo, addressInfo, txInfo
   */
  async _handleNewTx (addressInfo, txInfo) {
    console.log('newTransaction', addressInfo, txInfo)
    txInfo = D.copy(txInfo)
    addressInfo = D.copy(addressInfo)

    // async operation may lead to disorder. so we need a simple lock
    // eslint-disable-next-line
    while (this.busy) {
      await D.wait(5)
    }
    this.busy = true
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
      this.txInfos.push(txInfo)
    } else {
      this.txInfos[index] = txInfo
    }
    this.addressInfos.find(a => a.address === addressInfo.address).txs = D.copy(addressInfo.txs)

    // can't use BigInteger.ZERO here, addTo, subTo will modify the value of BigInteger.ZERO
    let newBalance = new BigInteger()
    newBalance.fromInt(0)
    this.txInfos.forEach(txInfo => {
      newBalance.addTo(new BigInteger(txInfo.value), newBalance)
      if (txInfo.direction === D.tx.direction.out) {
        newBalance.subTo(new BigInteger(txInfo.fee), newBalance)
      }
    })
    this.balance = newBalance.toString(10)

    await this._coinData.newTx(this._toAccountInfo(), addressInfo, txInfo, [])

    if (txInfo.confirmations < D.tx.getMatureConfirms(this.coinType)) {
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

  getTxInfos (startIndex, endIndex) {
    let accountId = this.accountId
    return this._coinData.getTxInfos({accountId, startIndex, endIndex})
  }

  async getAddress (isStoring = false) {
    await this._generateAddressIfNotExist()
    let path = D.makeBip44Path(this.coinType, this.index, D.address.external, 0)
    let address = await this._device.getAddress(this.coinType, path, true, isStoring)
    address = D.address.toEthChecksumAddress(address)
    let prefix = ''
    return {address: address, qrAddress: prefix + address}
  }

  getSuggestedFee () {
    return this._coinData.getSuggestedFee(this.coinType).fee
  }

  // noinspection JSMethodCanBeStatic
  checkAddress (address) {
    return D.address.checkEthAddress(address)
  }

  /**
   *
   * @param details
   * {
   *   sendAll: bool,
   *   output: {
   *     address: hex string,
   *     value: string (decimal string Wei)
   *   }
   *   gasPrice: string (=gasPrice, decimal string Wei),
   *   gasLimit: string (decimal string Wei),
   *   data: hex string (optional),
   * }
   * @returns {Promise<{total: *, fee: number, gasPrice: string, gasLimit: string, nonce: number, input: *, output: *, data: string}>}
   * {
   *   total: string (decimal string Wei)
   *   fee: string (decimal string Wei)
   *   gasPrice: string (decimal string Wei)
   *   gasLimit: string (decimal string Wei)
   *   nonce: string
   *   intput: addressInfo
   *   output: {
   *     address: hex string,
   *     value: string (decimal string Wei)
   *   }
   *   data: hex string
   * }
   */
  async prepareTx (details) {
    console.log('prepareTx details', details)

    if (!D.isEth(this.coinType)) throw D.error.coinNotSupported
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
      if (!data.match(/^[0-9a-fA-F]+$/)) throw D.error.invalidDataNotHex
      details.data = '0x' + data
    } else {
      details.data = '0x'
    }

    let input = D.copy(this.addressInfos[0])
    let nonce = this.txInfos.filter(txInfo => txInfo.direction === D.tx.direction.out).length
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
      data: details.data
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
    let gasLimit = new BigInteger(prepareTx.gasLimit).toString(16)
    gasLimit = '0x' + (gasLimit.length % 2 === 0 ? '' : '0') + gasLimit
    let value = new BigInteger(output.value).toString(16)
    value = '0x' + (value.length % 2 === 0 ? '' : '0') + value
    if (value == '0x00') value = '0x' // '0x00' will be encode as 0x00; '0x', '', null, 0 will be encode as 0x80, shit

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
        fee: prepareTx.fee
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
    this._handleNewTx(signedTx.addressInfo, signedTx.txInfo, [])
  }
}
