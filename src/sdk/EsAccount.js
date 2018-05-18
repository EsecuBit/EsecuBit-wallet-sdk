
const D = require('./D').class

// TODO listen transaction after boardcast a transaction successfully
const EsAccount = function (info) {
  this.info = info
  this.accountId = info.accountId
  this.label = info.label
  this.deviceId = info.deviceId
  this.passPhraseId = info.passPhraseId
  this.coinType = info.coinType
  this.balance = info.balance

  this._device = require('./hardware/CoreWallet').instance
  // TODO fix circle require
  this._coinData = require('./data/CoinData').instance
}
module.exports = {class: EsAccount}

EsAccount.prototype.getTransactionInfos = async function (startIndex, endIndex) {
  await this._coinData.getTransactionInfos(
    {
      accountId: this.accountId,
      startIndex: startIndex,
      endIndex: endIndex
    })
}

EsAccount.prototype.getAddress = async function (addressParam) {
  let address = await this._device.getAddress(addressParam)
  let prefix
  switch (this.coinType) {
    case D.COIN_BIT_COIN:
    case D.COIN_BIT_COIN_TEST:
      prefix = 'bitcoin:'
      break
    default:
      throw D.ERROR_COIN_NOT_SUPPORTED
  }
  return { address: address, qrAddress: prefix + address }
}

// TODO judge lockTime, judge confirmations?
EsAccount.prototype.sendBitCoin = async function (transaction, callback) {
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
  let response = await this._device.sendHexApduTrue(apdu, callback)
  let data = new Uint8Array(response)
  let intArray = new Uint8Array(new Array(2))
  intArray[0] = data[3]
  intArray[1] = data[4]
  console.log('data ' + D.arrayBufferToHex(response))
  console.log('data ' + D.arrayBufferToHex(data))
  console.log('sw ' + D.arrayBufferToHex(intArray))
  let sw = D.arrayBufferToHex(intArray)

  if (sw === '6FFA') {
    this.sendBitCoin(transaction, callback)
  }
  callback(sw === '9000' ? D.ERROR_NO_ERROR : D.ERROR_USER_CANCEL)
}
