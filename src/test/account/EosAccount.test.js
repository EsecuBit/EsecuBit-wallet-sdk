
import chai from 'chai'
import JsWallet from '../../sdk/device/JsWallet'
import EosAccount from '../../sdk/account/EosAccount'
import CoinData from '../../sdk/data/CoinData'
import D from '../../sdk/D'

chai.should()

describe('EosAccount', function () {
  const seed = '19bc2ed769682d9fc0d08b9a1f59306a5a1e63f140d5743c6a4076cc6b588e32b25c308e07fb0a16354463530c827c85bac67832794fa4798a701b063d01a341'
  let account

  before(async function () {
    let jsWallet = new JsWallet()
    await jsWallet.init(seed)
    account = new EosAccount({
      label: 'atestaccount',
      coinType: D.coin.main.eos,
      index: 0,
      balance: '50',
      externalPublicKeyIndex: 0,
      changePublicKeyIndex: 0,
      permissions: {
        owner: [{
          permission: 'owner',
          publicKey: '',
          keyPath: "m/48'/4'/0'/0'/0'"
        }],
        active: [{
          permission: 'active',
          publicKey: '',
          keyPath: "m/48'/4'/1'/0'/0'"
        }]
      }
    }, new JsWallet(), new CoinData())
  })

  it('signTx', async function () {
    let details = {
      type: 'tokenTransfer',
      token: 'EOS',
      outputs: [{
        account: 'inita',
        value: '70'
      }, {
        account: 'initb',
        value: '6.6'
      }]
    }
    let prepareTx = await account.prepareTx(details)
    // console.log('prepareTx', prepareTx, JSON.stringify(prepareTx, null, 2))
    prepareTx.should.deep.equal({
      expirationAfter: 600,
      actions: [
        {
          account: 'eosio.token',
          name: 'transfer',
          authorization: [
            {
              actor: 'atestaccount',
              permission: 'active'
            }
          ],
          data: {
            from: 'atestaccount',
            to: 'inita',
            quantity: '70 EOS',
            memo: ''
          }
        },
        {
          account: 'eosio.token',
          name: 'transfer',
          authorization: [
            {
              actor: 'atestaccount',
              permission: 'active'
            }
          ],
          data: {
            from: 'atestaccount',
            to: 'initb',
            quantity: '6.6 EOS',
            memo: ''
          }
        }
      ]
    })
    let buildTx = await account.buildTx(prepareTx)
    console.log('buildTx', buildTx, JSON.stringify(buildTx, null, 2))
    buildTx.should.not.equal(undefined)
  })
})
