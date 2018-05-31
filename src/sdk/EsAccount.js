
import D from './D'
import JsWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import CoinData from './data/CoinData'

// TODO surrounded with try catch
export default class EsAccount {
  constructor (info) {
    this.info = info
    this._device = D.TEST_JS_WALLET ? new JsWallet() : new CoreWallet()
    // TODO fix circle require
    this._coinData = new CoinData()
  }

  async getTxInfos (startIndex, endIndex) {
    return this._coinData.getTxInfos({
      accountId: this.info.accountId,
      startIndex: startIndex || 0,
      endIndex: endIndex || Number.MAX_SAFE_INTEGER
    })
  }

  async getAddress () {
    let address = await this._device.getAddress(this.info.externalPublicKeyIndex, this.info.externalPublicKey)
    let prefix
    switch (this.info.coinType) {
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
    if (this.info.coinType !== D.COIN_BIT_COIN && this.info.coinType !== D.COIN_BIT_COIN_TEST) throw D.ERROR_COIN_NOT_SUPPORTED

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

    let utxos = await this._coinData.getUtxos({accountId: this.info.accountId, spent: D.TX_UNSPENT})
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

    let changeAddress = await this._device.getAddress(this.info.changePublicKeyIndex, this.info.changePublicKey)
    let value = totalIn - prepareTx.total
    let rawTx = {
      inputs: prepareTx.utxos,
      outputs: prepareTx.outputs
    }
    rawTx.outputs.push({address: changeAddress, value: value})
    console.info(rawTx)
    let signedTx = await this._device.signTransaction(rawTx)
    let txInfo = {
      accountId: this.info.accountId,
      coinType: this.info.coinType,
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
  sendTx (signedTx) {
    return this._coinData.sendTx(this.info, signedTx.utxos, signedTx.txInfo, signedTx.hex)
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
