
import chai from 'chai'
import JsWallet from '../../sdk/device/implements/JsWallet'
import EosAccount from '../../sdk/account/EosAccount'
import CoinData from '../../sdk/data/CoinData'
import D from '../../sdk/D'
import JsTransmitter from '../../sdk/device/implements/transmitter/JsTransmitter'
import Settings from '../../sdk/Settings'

chai.should()

// describe('EosAccount sign only', function () {
//   this.timeout(60 * 1000)
//   let account
//   let jsWallet
//   let coinData
//
//   before(async function () {
//     jsWallet = new JsWallet(new JsTransmitter())
//     coinData = new CoinData()
//     let walletInfo = await jsWallet.init()
//     await coinData.init(walletInfo)
//
//     account = new EosAccount({
//       label: 'atestaccount',
//       coinType: D.coin.test.eosJungle,
//       accountId: 'eos_jungle_0_23f876c8a',
//       index: 0,
//       balance: '50',
//       externalPublicKeyIndex: 0,
//       changePublicKeyIndex: 0,
//       permissions: {
//         owner: [{
//           permission: 'owner',
//           publicKey: '',
//           keyPath: "m/48'/4'/0'/0'/0'"
//         }],
//         active: [{
//           permission: 'active',
//           publicKey: '',
//           keyPath: "m/48'/4'/1'/0'/0'"
//         }]
//       }
//     }, jsWallet, coinData)
//   })
//
//   after(async function () {
//     await coinData.release()
//   })
//
//   it('signTx', async function () {
//     let details = {
//       type: 'tokenTransfer',
//       token: 'EOS',
//       outputs: [{
//         account: 'inita',
//         value: '70'
//       }, {
//         account: 'initb',
//         value: '6.6'
//       }]
//     }
//     let prepareTx = await account.prepareTx(details)
//     console.log('prepareTx', prepareTx, JSON.stringify(prepareTx, null, 2))
//     prepareTx.should.deep.equal({
//       expirationAfter: 600,
//       actions: [
//         {
//           account: 'eosio.token',
//           name: 'transfer',
//           authorization: [
//             {
//               actor: 'atestaccount',
//               permission: 'active'
//             }
//           ],
//           data: {
//             from: 'atestaccount',
//             to: 'inita',
//             quantity: '70.0000 EOS',
//             memo: ''
//           }
//         },
//         {
//           account: 'eosio.token',
//           name: 'transfer',
//           authorization: [
//             {
//               actor: 'atestaccount',
//               permission: 'active'
//             }
//           ],
//           data: {
//             from: 'atestaccount',
//             to: 'initb',
//             quantity: '6.6000 EOS',
//             memo: ''
//           }
//         }
//       ],
//       comment: ''
//     })
//     let buildTx = await account.buildTx(prepareTx)
//     console.log('EosAccount buildTx', buildTx, JSON.stringify(buildTx, null, 2))
//     buildTx.should.not.equal(undefined)
//   })
// })

describe('EosAccount sync and sign', function () {
  D.test.coin = false
  this.timeout(60 * 1000)
  let account
  let jsWallet
  let coinData

  before(async function () {
    await new Settings().setTestSeed('write your own seed')

    jsWallet = new JsWallet(new JsTransmitter())
    coinData = new CoinData()
    let walletInfo = await jsWallet.init()
    await coinData.init(walletInfo)
    await coinData.clearData()

    account = new EosAccount({
      label: 'atestaccount',
      coinType: D.coin.main.eos,
      accountId: 'eos_main_0_23f876c8a',
      index: 0,
      balance: '0',
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
    }, jsWallet, coinData)
    await account.init()
    await account.sync()
  })

  after(async function () {
    // await coinData.clearData()
    // await coinData.release()
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
    console.log('prepareTx', prepareTx, JSON.stringify(prepareTx, null, 2))
    // prepareTx.should.deep.equal({
    //   expirationAfter: 600,
    //   actions: [
    //     {
    //       account: 'eosio.token',
    //       name: 'transfer',
    //       authorization: [
    //         {
    //           actor: 'atestaccount',
    //           permission: 'active'
    //         }
    //       ],
    //       data: {
    //         from: 'atestaccount',
    //         to: 'inita',
    //         quantity: '70 EOS',
    //         memo: ''
    //       }
    //     },
    //     {
    //       account: 'eosio.token',
    //       name: 'transfer',
    //       authorization: [
    //         {
    //           actor: 'atestaccount',
    //           permission: 'active'
    //         }
    //       ],
    //       data: {
    //         from: 'atestaccount',
    //         to: 'initb',
    //         quantity: '6.6 EOS',
    //         memo: ''
    //       }
    //     }
    //   ]
    // })
    let buildTx = await account.buildTx(prepareTx)
    console.log('EosAccount buildTx', buildTx, JSON.stringify(buildTx, null, 2))
    buildTx.should.not.equal(undefined)
  })
})
