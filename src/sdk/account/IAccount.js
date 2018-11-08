
import D from '../D'

export default class IAccount {
  constructor (info, device, coinData) {
    this._fromAccountInfo(info)
    this._device = device
    this._coinData = coinData
    this._listenedTxs = []
    this._listenedAddresses = []

    this._txListener = async (error, txInfo, isLost = false) => {
      if (error !== D.error.succeed) {
        console.warn('IAccount txListener', error)
        return
      }
      console.log('newTransaction status', txInfo)

      if (isLost) {
        await this._handleRemovedTx(txInfo.txId)
        return
      }

      let index = this.txInfos.findIndex(t => t.txId === txInfo.txId)
      if (index === -1) {
        console.warn('this should not happen, add it')
        this.txInfos.push(txInfo)
        index = this.txInfos.length - 1
      } else {
        // only update comfirmations, because txInfo may contains old info (e.g. gasLimit become gasUsed)
        this.txInfos[index].confirmations = txInfo.confirmations
      }
      await this._handleNewTx(this.txInfos[index])
    }

    this._addressListener = async (error, addressInfo, txInfo, removedTxId) => {
      if (error !== D.error.succeed) {
        console.warn('IAccount addressListener', error)
        return
      }
      if (removedTxId) {
        await this._handleRemovedTx(removedTxId)
        return
      }
      await this._handleNewTx(txInfo)
    }
  }

  /**
   * Generate account info from this object.
   *
   * @protected
   */
  _toAccountInfo () {
    let info = {}
    info.label = this.label
    info.accountId = this.accountId
    info.coinType = this.coinType
    info.index = this.index
    info.balance = this.balance
    info.externalPublicKeyIndex = this.externalPublicKeyIndex
    info.changePublicKeyIndex = this.changePublicKeyIndex

    // EOS
    if (this.queryOffset) info.queryOffset = this.queryOffset
    if (this.tokens) info.tokens = D.copy(this.tokens)
    if (this.resources) info.resources = D.copy(this.resources)
    return info
  }

  /**
   * Get account info from parameter.
   *
   * @param info Contains account, coinType, publicKeyIndex etc. more details see IndexedDB#account.
   * @protected
   */
  _fromAccountInfo (info) {
    this.label = info.label
    this.accountId = info.accountId
    this.coinType = info.coinType
    this.index = info.index
    this.balance = info.balance
    this.externalPublicKeyIndex = info.externalPublicKeyIndex
    this.changePublicKeyIndex = info.changePublicKeyIndex

    // EOS
    if (info.queryOffset) this.queryOffset = info.queryOffset
    if (info.tokens) this.tokens = D.copy(info.tokens)
    if (info.resources) this.resources = D.copy(info.resources)
  }

  async init () {
    let accountId = this.accountId
    this.addressInfos = await this._coinData.getAddressInfos({accountId})
    this.txInfos = (await this._coinData.getTxInfos({accountId})).txInfos
    // for BTC-liked account
    this.utxos = await this._coinData.getUtxos({accountId})
  }

  async sync (firstSync = false, offlineMode = false) {
    if (!offlineMode) {
      await this._checkAddressIndexAndGenerateNew(true)
    }

    let checkAddressInfos = D.copy(this.addressInfos)
    while (checkAddressInfos.length > 0) {
      // find out all the transactions
      let blobs = await this._coinData.checkAddresses(this.coinType, checkAddressInfos)
      let responses = await Promise.all(blobs.map(blob => {
        if (blob.removedTxId) {
          let removedTxInfo = this.txInfos.find(txInfo => txInfo.txId === blob.removedTxId)
          // let the txListener handle the overTime pending tx
          if (removedTxInfo && removedTxInfo.confirmations !== D.tx.confirmation.pending) {
            return this._handleRemovedTx(blob.removedTxId)
          }
        } else {
          return this._handleNewTx(blob.txInfo)
        }
      }))

      if (offlineMode) break
      if (responses.length === 0) break
      checkAddressInfos = D.copy(await this._checkAddressIndexAndGenerateNew(true))
    }

    if (firstSync) {
      let listenAddressInfos = await this._getActiveAddressInfos()
      for (let addressInfo of listenAddressInfos) {
        if (!this._listenedAddresses.includes(addressInfo.address)) {
          this._listenedAddresses.push(addressInfo.address)
          this._coinData.listenAddresses(this.coinType, [D.copy(addressInfo)], this._addressListener)
        }
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

  /**
   * delete account only when there are no transaction in it
   * @returns {Promise<void>}
   */
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
      throw D.error.invalidParams
    }
    await this._coinData.updateTxComment(txInfo)
    oldTxInfo.comment = txInfo.comment
  }

  getTxInfos (startIndex, endIndex) {
    let accountId = this.accountId
    return this._coinData.getTxInfos({accountId, startIndex, endIndex})
  }

  getSuggestedFee () {
    return this._coinData.getSuggestedFee(this.coinType).fee
  }

  // noinspection JSMethodCanBeStatic
  checkAddress (address) {
    return D.address.checkAddress(this.coinType, address)
  }

  async _getActiveAddressInfos () {
    await this._checkAddressIndexAndGenerateNew()
    return [this.addressInfos[this.externalPublicKeyIndex]]
  }

  // noinspection JSMethodCanBeStatic
  async _checkAddressIndexAndGenerateNew (sync = false) {
    throw D.error.notImplemented
  }

  async _handleRemovedTx (txId) {
    throw D.error.notImplemented
  }

  /**
   * handle when new transaction comes:
   * 1. store/update new txInfo after filling "isMine" and "value" field
   * 2. store utxo, addressInfo, txInfo
   */
  async _handleNewTx (txInfo) {
    throw D.error.notImplemented
  }

  async getAddress (isStoring = false) {
    throw D.error.notImplemented
  }

  /**
   * prepare transaction info before transaction
   */
  async prepareTx (details) {
    throw D.error.notImplemented
  }

  /**
   * use the result of prepareTx to make transaction
   * @param prepareTx
   * @returns {Promise<{txInfo, addressInfo, hex}>}
   * @see prepareTx
   */
  async buildTx (prepareTx) {
    throw D.error.notImplemented
  }

  /**
   * broadcast transaction to btcNetwork
   * @param signedTx
   * @param test won't broadcast to network if true
   * @see signedTx
   */
  async sendTx (signedTx, test = false) {
    throw D.error.notImplemented
  }
}
