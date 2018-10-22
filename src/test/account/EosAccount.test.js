
import chai from 'chai'
import FcBuffer from '../../sdk/device/EosFcBuffer'

chai.should()
describe('EosFcBuffer', function () {
  it ('serialTx', function () {
    let tx = {
      expiration: 1538569524,
      ref_block_num: 56170,
      ref_block_prefix: 3374189397,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'eosio.token',
        name: 'transfer',
        authorization: [
          {
            actor: 'inita',
            permission: 'active'
          }
        ],
        data: { // 被序列化前的数据
          from: 'inita',
          to: 'initb',
          quantity: '7.0000 SYS',
          memo: ''
        }
      }],
      'transaction_extensions': []
    }
    let response = FcBuffer.serializeTx(tx)
    console.log('serializeTx result', response.toString('hex'))
    response.should.deep.equal(
      Buffer.from('34b5b45b6adb550b1ec9000000000100a6823403ea3055000000572d3ccdcd01000000000093dd7400000000a8ed323221000000000093dd74000000008093dd74701101000000000004535953000000000000', 'hex'))
  })
})

describe('EosAccount', function () {
})
