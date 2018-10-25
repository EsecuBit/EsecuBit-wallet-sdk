
import chai from 'chai'
import D from '../../../sdk/D'
import EosPeer from '../../../sdk/data/network/EosPeer'

chai.should()
describe('Network EosPeer EOS', function () {
  this.timeout(10000)
  const eosPeer = new EosPeer(D.coin.main.eos)

  before(async function () {
    await eosPeer.init()
  })

  it('getBlockHeight', async function () {
    let blockHeight = await eosPeer.getBlockHeight()
    console.log('EosPeer getBlockHeight', blockHeight)
    blockHeight.should.at.least(1)
  })

  it('getBlockInfo', async function () {
    let blockInfo = await eosPeer.getBlockInfo()
    console.log('EosPeer getBlockInfo', blockInfo)
    blockInfo.should.include.all.keys('head_block_num', 'last_irreversible_block_num', 'last_irreversible_block_id')
  })

  it('getIrreversibleBlockInfo', async function () {
    let irInfo = await eosPeer.getIrreversibleBlockInfo()
    console.log('EosPeer getIrreversibleBlockInfo', irInfo)
    irInfo.lastIrreversibleBlockNum.should.at.least(0)
    irInfo.lastIrreversibleBlockId.should.be.a('string')
    irInfo.refBlockNum.should.at.least(0)
    irInfo.refBlockPrefix.should.at.least(0)
  })

  it('getAccountInfo', async function () {
    let accountInfo = await eosPeer.getAccountInfo('esecubit1111', {'EOS': {code: 'eosio.token', symbol: 'EOS', value: 0}})
    console.log('EosPeer getAccountInfo', accountInfo)
    Number(accountInfo.balance).should.at.least(0)

    let ram = accountInfo.resources.ram
    ram.used.should.at.least(0)
    ram.total.should.at.least(0)

    let cpu = accountInfo.resources.cpu
    cpu.weight.should.at.least(0)
    cpu.used.should.at.least(0)
    cpu.available.should.at.least(0)
    cpu.max.should.at.least(0)

    let net = accountInfo.resources.net
    net.weight.should.at.least(0)
    net.used.should.at.least(0)
    net.available.should.at.least(0)
    net.max.should.at.least(0)

    let stakeTotal = accountInfo.resources.stake.total
    Number(stakeTotal.cpu).should.at.least(0)
    Number(stakeTotal.net).should.at.least(0)

    let vote = accountInfo.resources.vote
    vote.proxy.should.be.a('string')
    Array.isArray(vote.producers).should.equal(true)
    vote.staked.should.be.a('string')
    vote.isProxy.should.be.a('boolean')

    let owner = accountInfo.permissions.owner
    owner.name.should.equal('owner')
    owner.parent.should.be.a('string')
    owner.threshold.should.at.least(0)
    Array.isArray(owner.pKeys).should.equal(true)
    owner.pKeys[0].publicKey.should.be.a('string')
    owner.pKeys[0].weight.should.at.least(1)

    let active = accountInfo.permissions.active
    active.name.should.equal('active')
    active.parent.should.be.a('string')
    active.threshold.should.at.least(0)
    Array.isArray(active.pKeys).should.equal(true)
    active.pKeys[0].publicKey.should.be.a('string')
    active.pKeys[0].weight.should.at.least(1)
  })

  it('queryTx', async function () {
    let tx = await eosPeer.queryTx('a9a19e11e0bfaae4f0b825633adbd51d193bee098285fe79c07a7b0a7a6bf500')
    console.log('EosPeer queryTx', tx)
    tx.txId.should.be.a('string')
    tx.blockNumber.should.at.least(1)
    tx.confirmations.should.equal(D.tx.confirmation.excuted)
    tx.time.should.at.least(1)
    tx.actions.should.have.length.at.least(1)
  })

  it('queryAddress', async function () {
    let txs = await eosPeer.queryAddress('esecubit1111')
    let maxSeq = await eosPeer.getMaxActionSeq('esecubit1111')
    console.log('EosPeer queryAddress', txs, maxSeq)
    for (let tx of txs) {
      console.warn(tx)
      tx.txId.should.be.a('string')
      tx.blockNumber.should.at.least(1)
      tx.confirmations.should.equal(D.tx.confirmation.excuted)
      tx.time.should.at.least(1)
      tx.actions.should.have.length.at.least(1)
    }

    let remainTxs = await eosPeer.queryAddress('esecubit1111', maxSeq)
    let newMaxSeq = await eosPeer.getMaxActionSeq('esecubit1111')
    remainTxs.should.have.length(0)
    newMaxSeq.should.equal(maxSeq)
  })
})
