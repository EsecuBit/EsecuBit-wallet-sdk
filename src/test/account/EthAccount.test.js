
import chai from 'chai'
import D from '../../sdk/D'
import EsWallet from '../../sdk/EsWallet'
import Settings from '../../sdk/Settings'

chai.should()
describe('EthAccount', function () {
  this.timeout(60000)
  let esWallet
  let oldSupported

  // new EsWallet may trigger sync, so do it when doing Test
  before(async function () {
    D.test.coin = true
    D.test.jsWallet = true
    oldSupported = D.supportedCoinTypes
    D.supportedCoinTypes = () => [D.coin.test.ethRinkeby]
    await new Settings().setTestSeed('00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')
    esWallet = new EsWallet()
  })

  after(function () {
    D.supportedCoinTypes = oldSupported
  })

  it('listenStatus', function (done) {
    esWallet.listenTxInfo((error, txInfo) => {
      console.log('detect new tx', error, txInfo)
    })
    esWallet.listenStatus((error, status) => {
      console.log('error, status', error, status)
      if (error !== D.error.succeed) {
        console.warn('error, status', error, status)
        done(error)
        return
      }
      if (status === D.status.syncFinish) {
        done()
      }
    })
  })

  let account = null
  it('checkAccount', async function () {
    let accounts = await esWallet.getAccounts()
    accounts.length.should.not.equal(0)
    let ethAccount = accounts.find(account => account.coinType === D.coin.test.ethRinkeby)
    ethAccount.should.not.equal(undefined)
    account = ethAccount
    account.txInfos.length.should.above(0)
    account.addressInfos.length.should.above(0)
    Number(account.balance).should.above(0)
  })

  it('getTxInfos', async function () {
    let {total, txInfos} = await account.getTxInfos(0, 100)
    total.should.above(0)
    txInfos.length.should.above(0)
    txInfos.forEach(tx => {
      tx.accountId.should.equal(account.accountId)
      tx.coinType.should.equal(account.coinType)
      tx.txId.should.be.a('string').and.lengthOf(66)
      tx.blockNumber.should.be.a('number')
      tx.confirmations.should.be.a('number')
      tx.time.should.be.a('number')
      tx.direction.should.be.oneOf([D.tx.direction.in, D.tx.direction.out])
      tx.inputs.should.lengthOf(1)
      tx.outputs.should.lengthOf(1)
      Number(tx.value).should.be.a('number')
      Number(tx.fee).should.be.a('number')
      tx.link.should.equal('https://rinkeby.etherscan.io/tx/' + tx.txId)
      tx.inputs.forEach(input => {
        input.prevAddress.should.be.a('string')
        input.isMine.should.be.a('boolean')
        Number(input.value).should.above(0)
      })
      tx.outputs.forEach(output => {
        output.address.should.be.a('string')
        output.isMine.should.be.a('boolean')
        Number(output.value).should.above(0)
      })
    })
  })

  it('rename', async function () {
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

  it('checkAddress', () => {
    let error = D.error.succeed

    account.checkAddress('0x52908400098527886E0F7030069857D2E4169EE7')
    account.checkAddress('0x8617E340B3D01FA5F11F306F4090FD50E238070D')
    account.checkAddress('0xde709f2102306220921060314715629080e2fb77')
    account.checkAddress('0x27b1fdb04752bbc536007a920d24acb045561c26')
    account.checkAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
    account.checkAddress('0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359')
    account.checkAddress('0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB')
    account.checkAddress('0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb')
    error.should.equal(D.error.succeed)

    try {
      error = D.error.succeed
      account.checkAddress('0xc18f087c3837d974d6911c68404325e11999cf12')
    } catch (e) {
      error = e
    }
    error.should.equal(D.error.noAddressCheckSum)

    try {
      error = D.error.succeed
      account.checkAddress('')
    } catch (e) {
      error = e
    }
    error.should.equal(D.error.invalidAddress)

    try {
      error = D.error.succeed
      account.checkAddress('0x')
    } catch (e) {
      error = e
    }
    error.should.equal(D.error.invalidAddress)

    try {
      error = D.error.succeed
      account.checkAddress('0xc18f0')
    } catch (e) {
      error = e
    }
    error.should.equal(D.error.invalidAddress)

    try {
      error = D.error.succeed
      account.checkAddress('0xc18f087c3837d974d6911c68404325e11999')
    } catch (e) {
      error = e
    }
    error.should.equal(D.error.invalidAddress)
  })

  it('getAddress', async function () {
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

  it('sendTx', async function () {
    for (let nonce = 0; nonce < 1; nonce++) {
      let prepareTx = await account.prepareTx({
        gasPrice: '1000000000',
        output: {address: '0x5c69f6b7a38ca89d5dd48a7f21be5f1030760891', value: '3200000000000'}
      })
      console.log('prepareTx', prepareTx)
      let signedTx = await account.buildTx(prepareTx)
      console.log('signedTx', signedTx)
      // await account.sendTx(signedTx)
    }
  })

  let tokenInfo = null
  it('addToken', async function () {
    let tokenList = await esWallet.getEthTokenList()
    tokenInfo = tokenList.find(t => t.name === 'BNB')
    tokenInfo.name.should.equal('BNB')
    await account.addToken(tokenInfo)
    await account.addToken({
      symbol: 'ESBIT',
      name: 'Example Fixed Supply Token',
      address: '0xbcf39e6d4b31871cac03c60d774f33ae7b147f55',
      decimals: 9,
      type: 'ERC20'
    })

    let tokens = await account.getTokens()
    tokens.should.lengthOf(2)
  })

  it('sendTokenTx', async function () {
    let tokens = await account.getTokens()
    tokens.should.lengthOf(2)
    let token = tokens.find(t => t.symbol === 'ESBIT')

    let prepareTx = await token.prepareTx({
      output: {
        address: '0xc18f087c3837d974d6911c68404325e11999cf12',
        value: '23.566'
      },
      gasPrice: '8000000000'
    })
    console.log('prepareTx', prepareTx)
    let signedTx = await token.buildTx(prepareTx)
    console.log('signedTx', signedTx)

    // await account.sendTx(signedTx)
  })

  it('removeToken', async function () {
    await account.removeToken(tokenInfo)
    await account.removeToken({
      address: '0xbcf39e6d4b31871cac03c60d774f33ae7b147f55'
    })
    let tokens = await account.getTokens()
    tokens.should.lengthOf(0)
  })
})
