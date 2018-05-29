
import chai from 'chai'
import D from '../sdk/D'
import CoinData from '../sdk/data/CoinData'
import JsWallet from '../sdk/device/JsWallet'

chai.should()
describe('EsAccount', function () {
  const jsWallet = new JsWallet()
  const coinData = new CoinData()

  let account = null
  it('checkAccount', async () => {
    let info = await jsWallet.init()
    await coinData.init(info)
    let accounts = await coinData.getAccounts()
    accounts.length.should.not.equal(0)
    accounts[0].info.coinType.should.equal(D.COIN_BIT_COIN_TEST)
    account = accounts[0]
    let utxo = await coinData.getUtxos(account.accountId)
    utxo.length.should.not.equal(0)
  })

  it('getTxInfos', async () => {
    let [total, txInfos] = await account.getTxInfos(0, 100)
    total.should.above(0)
    txInfos.length.should.not.equal(0)
    txInfos.forEach(tx => {
      tx.accountId.should.equal(account.info.accountId)
      tx.coinType.should.equal(account.info.coinType)
      tx.txId.should.be.a('string').and.lengthOf(64)
      tx.version.should.above(0)
      tx.blockNumber.should.above(0)
      tx.confirmations.should.be.a('number')
      tx.lockTime.should.be.a('number')
      tx.time.should.be.a('number')
      tx.direction.should.be.oneOf([D.TX_DIRECTION_IN, D.TX_DIRECTION_OUT])
      tx.inputs.should.lengthOf.above(0)
      tx.outputs.should.lengthOf.above(0)
      tx.value.should.above(0)
      tx.inputs.forEach(input => {
        input.prevAddress.should.be.a('string')
        input.isMine.should.be.a('boolean')
        input.value.should.above(0)
      })
      tx.outputs.forEach(output => {
        output.address.should.be.a('string')
        output.isMine.should.be.a('boolean')
        output.value.should.above(0)
      })
    })
  })

  it('getAddress', async () => {
    let address = await account.getAddress()
    address.address.should.be.a('string')
    address.qrAddress.should.be.a('string')
  })

  it('perpareTransaction', async () => {

  })
})
