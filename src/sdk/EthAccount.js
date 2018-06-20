
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
      } else {
        this.txInfos[index] = D.copy(txInfo)
      }
      await this._coinData.saveOrUpdateTxInfo(D.copy(txInfo))
    }

    this._addressListener = async (error, addressInfo, txInfo, utxos) => {
      if (error !== D.error.succeed) {
        console.warn('BtcAccount addressListener', error)
        return
      }
      console.log('newTransaction', addressInfo, txInfo, utxos)
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

  async sync (firstSync = false) {
    // find out all the transactions
    let blobs = await this._coinData.checkAddresses(this.coinType, this.addressInfos)
    await Promise.all(blobs.map(blob => this._handleNewTx(blob.addressInfo, blob.txInfo, blob.utxos)))
    if (firstSync) {
      this._coinData.listenAddresses(this.coinType, D.copy(this.addressInfos), this._addressListener)
      this.txInfos.filter(txInfo => txInfo.confirmations < D.tx.getMatureConfirms(this.coinType))
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
    this.addressInfos.find(a => a.address === addressInfo.address).txs = D.copy(addressInfo.txs)

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

  async getTxInfos (startIndex, endIndex) {
    let accountId = this.accountId
    return this._coinData.getTxInfos({accountId, startIndex, endIndex})
  }

  async getAddress () {
    let path = D.makeBip44Path(this.coinType, this.index, 0, 0)
    let address = await this._device.getAddress(this.coinType, path)
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
   *   feeRate: number (Wei),
   *   outputs: [{    // only the first output will be used
   *     address: hex string,
   *     value: number (Wei)
   *   }]
   *   data: hex string (optional)
   * }
   * @returns {Promise<prepareTx>}
   * {
   *   total: number (Wei)
   *   fee: number (Wei)
   *   gasPrice: number (Wei)
   *   startGas: number (Wei)
   *   nonce: number
   *   intput: addressInfo
   *   output: {
   *     address: hex string,
   *     value: number (Wei)
   *   }
   *   data: hex string
   * }
   */
  async prepareTx (details) {
    if (!D.isEth(this.coinType)) throw D.error.coinNotSupported
    if (details.data) throw D.error.notImplemented

    let estimateGas = (details) => {
      if (!details.data) {
        return 21000
      }
      throw D.error.notImplemented
    }

    // TODO later support data
    let input = this.addressInfos[0]
    let startGas = estimateGas(details)
    let gasPrice = details.feeRate
    let nonce = this.txInfos.filter(txInfo => txInfo.direction === D.tx.direction.out).length
    let fee = startGas * gasPrice
    let total = fee + details.outputs[0].value
    if (total > this.balance) throw D.error.balanceNotEnough

    return {
      total: total,
      fee: fee,
      gasPrice: gasPrice,
      startGas: startGas,
      nonce: nonce,
      input: D.copy(input),
      output: D.copy(details.outputs[0]),
      data: details.data ? details.data : '0x'
    }
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    let signedTx = await this._device.signTransaction(this.coinType, {
      input: {address: prepareTx.input.address, path: prepareTx.input.path},
      output: {address: prepareTx.output.address, value: prepareTx.output.value},
      nonce: prepareTx.nonce,
      gasPrice: prepareTx.gasPrice,
      startGas: prepareTx.startGas,
      data: prepareTx.data
    })
    return {
      txInfo: {
        accountId: this.accountId,
        coinType: this.coinType,
        txId: signedTx.id,
        blockNumber: -1,
        confirmations: -1,
        time: new Date().getTime(),
        direction: D.tx.direction.out,
        inputs: [{
          prevAddress: prepareTx.input.address,
          isMine: true,
          value: prepareTx.output.value
        }],
        outputs: [{
          address: prepareTx.output.address,
          isMine: false,
          value: prepareTx.output.value
        }]
      },
      addressInfo: prepareTx.input,
      hex: signedTx.hex
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
    if (!test) await this._coinData.sendTx(this._toAccountInfo(), [], signedTx.txInfo, signedTx.hex)
    await this._handleNewTx(signedTx.addressInfo, signedTx.txInfo, [])
  }
}
