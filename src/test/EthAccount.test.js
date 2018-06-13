
import chai from 'chai'
import D from '../sdk/D'
import EsWallet from '../sdk/EsWallet'

chai.should()
describe('EthAccount', function () {
  this.timeout(60000)
  let esWallet

  // new EsWallet will trigger heavy work, so make it lazy
  it('new wallet', async () => {
    D.test.sync = true
    esWallet = new EsWallet()
  })

  it('listenStatus', (done) => {
    const statusList = [D.status.plugIn, D.status.initializing, D.status.syncing, D.status.syncFinish]
    let currentStatusIndex = 0

    esWallet.listenTxInfo((error, txInfo) => {
      console.log('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.log('error, status', error, status)
      if (error !== D.error.succeed) {
        done(error)
        return
      }
      if (status !== statusList[currentStatusIndex]) {
        done(status !== statusList[currentStatusIndex])
        return
      }
      currentStatusIndex++
      if (currentStatusIndex === statusList.length) {
        done()
      }
    })
  })

  let account = null
  it('checkAccount', async () => {
    let accounts = await esWallet.getAccounts()
    accounts.length.should.not.equal(0)
    let ethAccount = accounts.find(account => account.coinType === D.coin.test.ethRinkeby)
    ethAccount.should.not.equal(undefined)
    account = ethAccount
    account.txInfos.length.should.above(0)
    account.addressInfos.length.should.above(0)
    account.balance.should.above(0)
  })

  it('getTxInfos', async () => {
    let {total, txInfos} = await account.getTxInfos(0, 100)
    total.should.above(0)
    txInfos.length.should.not.equal(0)
    txInfos.forEach(tx => {
      console.log('tx', tx)
      tx.accountId.should.equal(account.accountId)
      tx.coinType.should.equal(account.coinType)
      tx.txId.should.be.a('string').and.lengthOf(66)
      tx.blockNumber.should.be.a('number')
      tx.confirmations.should.be.a('number')
      tx.time.should.be.a('number')
      tx.direction.should.be.oneOf([D.tx.direction.in, D.tx.direction.out])
      tx.inputs.should.lengthOf(1)
      tx.outputs.should.lengthOf(1)
      tx.value.should.not.equal(0)
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

  it('rename', async () => {
    let oldName = account.label
    let newName = 'This is a test account name'
    await account.rename(newName)
    account.label.should.not.equal(oldName)
    account.label.should.equal(newName)

    let reloadAccount = (await esWallet.getAccounts()).find(a => a.accountId === account.accountId)
    reloadAccount.should.not.equal(undefined)
    reloadAccount.label.should.not.equal(oldName)
    reloadAccount.label.should.equal(newName)

    await account.rename(oldName)
    account.label.should.not.equal(newName)
    account.label.should.equal(oldName)

    reloadAccount = (await esWallet.getAccounts()).find(a => a.accountId === account.accountId)
    reloadAccount.should.not.equal(undefined)
    reloadAccount.label.should.not.equal(newName)
    reloadAccount.label.should.equal(oldName)
  })

  it('getAddress', async () => {
    let address = await account.getAddress()
    address.address.should.be.a('string')
    address.qrAddress.should.be.a('string')
  })

  it('getSuggestedFee', () => {
    let fee = account.getSuggestedFee()
    console.log('suggested fee', fee)
    fee[D.fee.economic].should.above(0)
    fee[D.fee.normal].should.at.least(fee[D.fee.economic])
    fee[D.fee.fast].should.at.least(fee[D.fee.normal])
  })

  it('sendTx', async () => {
    let prepareTx = await account.prepareTx({
      feeRate: 10,
      outputs: [{
        address: 'mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X',
        value: 30000
      }, {
        address: 'mqjGANawowPiTDKKtuqdf7mqumWAoyHsdG',
        value: 10000
      }]
    })
    console.log('prepareTx', prepareTx)
    let signedTx = await account.buildTx(prepareTx)
    console.log('signedTx', signedTx)
    // await account.sendTx(signedTx)
  })
})
