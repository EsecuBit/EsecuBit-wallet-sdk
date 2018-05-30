
import chai from 'chai'
import D from '../../../sdk/D'
import BlockchainInfo from '../../../sdk/data/network/BlockChainInfo'

chai.should()
describe('Network BlockChainInfo Bitcoin', function () {
  this.timeout(3000)
  const blockchainInfo = new BlockchainInfo(D.COIN_BIT_COIN_TEST)

  it('init network', async () => {
    let response = await blockchainInfo.init()
    response.should.not.equal(undefined)
  })

  it('query address', async () => {
    let e = D.ERROR_NO_ERROR
    try {
      await blockchainInfo.queryAddress('mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8')
    } catch (error) {
      e = error
    }
    e.should.equal(D.ERROR_NOT_IMPLEMENTED)
  })

  it('query addresses', async () => {
    let response = await blockchainInfo.queryAddresses(['mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8', 'mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X'])
    response.should.deep.equal(JSON.parse(
      '[{"address":"mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8","txCount":1,"txs":[{"txId":"45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10","version":1,"blockNumber":1309033,"confirmations":904,"time":1527042691,"hasDetails":true,"inputs":[{"prevAddress":"n1ZeY35ALhicxFi4PYc4Nc77B9zzzzfAzM","value":69431710}],"outputs":[{"address":"mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8","value":10000000,"index":0,"script":"76a914951d72fd25e82be5c1c31e0d9ab34372edc4e10588ac"}]}]},' +
      '{"address":"mn4ddJmfccTr5rSp1LTknPpdKatiaivw2X","txCount":0,"txs":[]}]'))
  })

  it('query transaction', async () => {
    let response = await blockchainInfo.queryTx('45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10')
    response.should.deep.equal(JSON.parse('{"txId":"45a1a9707d67730961dffe363cec5645b1460715e59955ce389df4f6dcc16f10","version":1,"blockNumber":1309033,"confirmations":904,"time":1527042691,"hasDetails":true,"inputs":[{"prevAddress":"n1ZeY35ALhicxFi4PYc4Nc77B9zzzzfAzM","value":69431710}],"outputs":[{"address":"mu7QFoRttcxmJLedCuznEtVXCVZofCPkp8","value":10000000,"index":0,"script":"76a914951d72fd25e82be5c1c31e0d9ab34372edc4e10588ac"},{"address":"mxFYnrJoMHP5jnFpTwvoEi2SmN2kNB6Cmr","value":59431210,"index":1,"script":"76a914b79047772fb5b4237aec1ce53dad76ead349232588ac"}]}'))
  })
})
