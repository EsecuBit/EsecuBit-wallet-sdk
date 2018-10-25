
import chai from 'chai'
import D from '../../sdk/D'
import JsWallet from '../../sdk/device/JsWallet'
import FcBuffer from '../../sdk/device/EosFcBuffer'

chai.should()

D.test.coin = false
const jsWallet = new JsWallet()
// menmonic: quick hurt retire forget pupil street twin volcano width word leaf salt
const seed = '19bc2ed769682d9fc0d08b9a1f59306a5a1e63f140d5743c6a4076cc6b588e32b25c308e07fb0a16354463530c827c85bac67832794fa4798a701b063d01a341'

describe('JsWallet Bitcoin', function () {
  this.timeout('10000')

  before(async function () {
    await jsWallet.init(seed)
  })

  it('getAddress', async function () {
    let address = await jsWallet.getAddress(D.coin.main.btc, "m/44'/0'/0'/0/0")
    address.should.equal('1PPLtigdq195KGQxUnQd2XpHnsQoQraPuS')
  })

  it('signTransaction', async function () {
    let response = await jsWallet.signTransaction(D.coin.main.btc, {
      inputs: [{
        address: '1PPLtigdq195KGQxUnQd2XpHnsQoQraPuS',
        path: "m/44'/0'/0'/0/0",
        txId: '61d520ccb74288c96bc1a2b20ea1c0d5a704776dd0164a396efec3ea7040349d',
        index: 0
      }],
      outputs: [{
        address: '1Q1EKJQKQm8GUpwyWSPDPTMq5nbW4gqSPD',
        value: 12000
      }]
    })
    response.should.deep.equal({
      id: 'ef0ec4f81d3f7ab394ffd2357b83120ebd85da8abc8baed88a2904d156f517db',
      hex: '01000000019d344070eac3fe6e394a16d06d7704a7d5c0a10eb2a2c16bc98842b7cc20d561000000006a47304402204bc063049378cdc960d45f5bac1406550c6643bd1b0bbf78e43d1839d29af87b02204eb99cc1e818cd2252dd0d7921441b2b4a0c65945e775a2c7424d3313325421d0121020329223a07aed46233f504c600ea04efd1484e05f5e0fc29e93a7739a8058fb1fdffffff01e02e0000000000001976a914fc56021d6ba6b3c60bb5f69a8b4f526addc5a33c88ac00000000'
    })
  })
})

describe('JsWallet Ethernum', function () {
  this.timeout('10000')

  before(async function () {
    await jsWallet.init(seed)
  })

  it('getAddress', async function () {
    let address = await jsWallet.getAddress(D.coin.test.ethRinkeby, "m/44'/60'/0'/0/0")
    address.should.equal('0x06b9d168c569b29e0728b7a1560d85123b622b9d')
  })

  it('signTransaction', async function () {
    let path = "m/44'/60'/0'/0/0"
    let address = await jsWallet.getAddress(D.coin.test.ethRinkeby, path)
    address.should.equal('0x06b9d168c569b29e0728b7a1560d85123b622b9d')
    let nonce = 0
    let response = await jsWallet.signTransaction(D.coin.test.ethRinkeby, {
      input: {address: address, path: path},
      output: {address: '0x06b9d168c569b29e0728b7a1560d85123b622b9d', value: 10000000000000000},
      nonce: nonce,
      gasPrice: 2000000000,
      startGas: 210000,
      data: ''
    })
    console.log('eth sign response', response)
    response.should.deep.equal({
      id: '0xf2f1a4e19d604793d60caf7766c49b73333dc4b52b9b9d4194498e7d1d766aab',
      hex: 'f868808477359400809406b9d168c569b29e0728b7a1560d85123b622b9d872386f26fc10000802ba083a415c97d085c7e857caa343f7b1f84cf3a049ec7b928b3fe85ecf3de35c29ba0401eee7baa9e2da68cadf1e2de3f1275a5f3a57fbd16684580c922588058d567'
    })
  })
})

describe('JsWallet EOS', function () {
  this.timeout('10000')

  const tx = {
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
      data: {
        from: 'inita',
        to: 'initb',
        quantity: '7.0000 SYS',
        memo: ''
      }
    }],
    transaction_extensions: [],
    keyPaths: ["m/48'/4'/1'/0'/0'"]
  }

  before(async function () {
    await jsWallet.init(seed)
  })

  it('serialTx', function () {
    let response = FcBuffer.serializeTx(tx)
    console.log('serializeTx result', response.toString('hex'))
    response.should.deep.equal(
      Buffer.from('34b5b45b6adb550b1ec9000000000100a6823403ea3055000000572d3ccdcd01000000000093dd7400000000a8ed323221000000000093dd74000000008093dd74701101000000000004535953000000000000', 'hex'))
  })

  it('signTransaction', async function () {
    let {txId, signedTx} = await jsWallet._signEos(D.coin.main.eos, tx)
    console.log('eos sign signatures', txId, signedTx)
  })

  it('signTransaction2', async function () {
    const tx = {
      expiration: 1540211560,
      ref_block_num: 60832,
      ref_block_prefix: 2249681555,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'okkkkkkkkkkk',
        name: 'transfer',
        authorization: [
          {
            actor: 'bosbosbosbos',
            permission: 'active'
          }
        ],
        data: {
          from: 'bosbosbosbos',
          to: 'todaytotoday',
          quantity: '100 BOS',
          memo: 'BOS CAMPAİGN: You win 500 BOS. Youre luck'
        }
      }],
      transaction_extensions: [],
      keyPaths: ["m/48'/4'/1'/0'/0'"]
    }
    let {txId, signedTx} = await jsWallet._signEos(D.coin.main.eos, tx)
    console.log('eos sign signatures', txId, JSON.stringify(signedTx, null, 2))
    txId.should.equal('7d4924cbd382cbb9fb4f260d4b0f272ebaadfeba566d54835c632de424a54884')
    signedTx.should.deep.equal({
      expiration: 1540211560,
      ref_block_num: 60832,
      ref_block_prefix: 2249681555,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [
        {
          account: 'okkkkkkkkkkk',
          name: 'transfer',
          authorization: [
            {
              actor: 'bosbosbosbos',
              permission: 'active'
            }
          ],
          data: {
            'from': 'bosbosbosbos',
            to: 'todaytotoday',
            quantity: '100 BOS',
            memo: 'BOS CAMPAİGN: You win 500 BOS. Youre luck'
          }
        }
      ],
      transaction_extensions: [],
      signatures: [
        'SIG_K1_KoQbR8eyLnHH8aTTaJQt2MLDFKbB2ScvPxyEwjKFSwKujJQedRMirgmde9e2wumKK1zfog3jZBPyKjUrW9g5Ngy7zxNJ4y'
      ]
    })
  })
})
