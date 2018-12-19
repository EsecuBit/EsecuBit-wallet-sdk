
import chai from 'chai'
import JsWallet from '../../sdk/device/implements/JsWallet'
import EosAccount from '../../sdk/account/EosAccount'
import CoinData from '../../sdk/data/CoinData'
import D from '../../sdk/D'
import JsTransmitter from '../../sdk/device/implements/transmitter/JsTransmitter'
import Settings from '../../sdk/Settings'
import S300Wallet from '../../sdk/device/implements/S300Wallet'
import CcidTransmitter from '../../sdk/device/implements/transmitter/CcidTransmitter'

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

D.test.jsWallet = false
D.test.coin = true

describe('EosAccount sync and sign', function () {
  this.timeout(60 * 1000)
  let account
  let coinData

  before(async function () {
    let coinType = D.test.coin ? D.coin.test.eosJungle : D.coin.main.eos
    D.supportedCoinTypes = () => [coinType]

    let transmitter
    let wallet
    if (D.test.jsWallet) {
      // write your own seed
      await new Settings().setTestSeed('00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')
      transmitter = new JsTransmitter()
      wallet = new JsWallet(transmitter)
    } else {
      transmitter = new CcidTransmitter()
      wallet = new S300Wallet(transmitter)
    }
    transmitter.listenPlug(async (error, status) => {
      if (error !== D.error.succeed) {
        throw error
      }
      if (status === D.status.plugIn) {
        coinData = new CoinData()
        let walletInfo = await wallet.init()
        await coinData.init(walletInfo)
        // await coinData.clearData()

        account = new EosAccount({
          label: 'sickworm1111',
          coinType: coinType,
          accountId: coinType + '_0_23f876c8a',
          index: 0,
          balance: '0',
          externalPublicKeyIndex: 0,
          changePublicKeyIndex: 0
        }, wallet, coinData)
        await account.init()
        try {
          await account.sync((error, status, pms) => {
            console.warn('sync', error, status, pms)
          })
          // await account.checkNewPermission((error, status, pms) => {
          //   console.warn('checkNewPermission', error, status, pms)
          // })
        } catch (e) {
          console.warn(e)
        }
        this.finish = true
      }
    })

    while (!this.finish) {
      await D.wait(10)
    }
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
    let buildTx = await account.buildTx(prepareTx)
    console.log('EosAccount buildTx', buildTx, JSON.stringify(buildTx, null, 2))
    buildTx.should.not.equal(undefined)
  })
})
