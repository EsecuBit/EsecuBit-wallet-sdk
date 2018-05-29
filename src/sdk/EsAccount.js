
import D from './D'
import JsWallet from './device/JsWallet'
import CoreWallet from './device/CoreWallet'
import CoinData from './data/CoinData'

// TODO listen transaction after boardcast a transaction successfully
const EsAccount = function (info) {
  this.info = info

  this._device = D.TEST_JS_WALLET ? new JsWallet() : new CoreWallet()
  // TODO fix circle require
  this._coinData = new CoinData()
}

EsAccount.prototype.getTxInfos = async function (startIndex, endIndex) {
  return this._coinData.getTxInfos(
    {
      accountId: this.accountId,
      startIndex: startIndex || 0,
      endIndex: endIndex || Number.MAX_SAFE_INTEGER
    })
}

EsAccount.prototype.getAddress = async function () {
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
 * @param details:
 * {
 *     fee: long (bitcoin -> santoshi),
 *     outputs: [{
 *       address: base58 string,
 *       value: long (bitcoin -> santoshi)
 *     }]
 * }
 * @returns {Promise<void>}
 */
EsAccount.prototype.buildTransaction = async function (details) {
  let utxos = await this._coinData.getUtxos({accountId: this.info.accountId})
  let total = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
  let fee = details.fee
  let totalOut = details.outputs.reduce((sum, output) => sum + output.value, 0)
  let inputs = []
  let getSuitableUtxo = () => {

  }
  while (true) {
    if (total < fee + totalOut) throw D.ERROR_TX_NOT_ENOUGH_VALUE

    break
  }
}

// TODO judge lockTime, judge confirmations?
EsAccount.prototype.sendBitCoin = function (transaction, callback) {
  let enc = new TextEncoder()
  console.dir(enc)

  let total = transaction.out + transaction.fee
  let totalString = this._coinData.getFloatFee(total) + ' BTC'
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
  callback(sw === '9000' ? D.ERROR_NO_ERROR : D.ERROR_USER_CANCEL)
}

export default {class: EsAccount}