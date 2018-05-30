/* eslint-disable no-undef */

// require('babel-core/register')
// require('babel-polyfill')
//
// var should = require('chai').should()

// (async function() {
//   // await解决回调问题，创建一个phantom实例
//   const instance = await phantom.create()
//   //通过phantom实例创建一个page对象，page对象可以理解成一个对页面发起请求和处理结果这一集合的对象
//   const page = await instance.createPage()
//   //页面指向的是哪个一个url
//   await page.on('onResourceRequested', function(requestData) {
//     console.info('Requesting', requestData.url)
//   })
//   //得到打开该页面的状态码
//   const status = await page.open('https://stackoverflow.com/')
//   console.info(status)
// //输出该页面的内容
//   const content = await page.property('content')
//   console.info(content)
//   //输出内容
//   //退出该phantom实例
//   await instance.exit()
// }())

// describe('Simple Test', function () {
//   it('1 == 1', function () {
//     var i = 1
//     i.should.equal(1)
//   })
//
//   it('#async test', async function abc() {
//     var i = 1
//     i.should.equal(1)
//   })
// })

const Web3 = require('web3')
if (typeof web3 !== 'undefined') {
  console.info('already has web3')
  web3 = new Web3(web3.currentProvider)
} else {
  // set the provider you want from Web3.providers
  // web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'))
  console.warn('no web3 instance')
}

console.info(web3.version)

// messageHash:'0x7dbc5644b83abd32d014d170ba9bdc855c126328c0cb41af0ed6422bef0bb32e'
// r:'0x2580390416fe8c951e8e0b12b349ce9a530f67f2cabb88ab70378789a83bbd4b'
// rawTransaction:'0xf86c808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008026a02580390416fe8c951e8e0b12b349ce9a530f67f2cabb88ab70378789a83bbd4ba05d897576a89e995d4f28fca55e63ca587b827a852bf5fe1ed75dbd2af1d1761e'
// s:'0x5d897576a89e995d4f28fca55e63ca587b827a852bf5fe1ed75dbd2af1d1761e'
// v:'0x26'
//
//
// address:'0x87De4942d53eD16F4523e50BBDf4622345C63A55'
// privateKey:'0x3a797ee4983149f4b74ff9ea97ae1813afe687477f11bf7b10bca788c17d68c7'
// nonce:'1'
// chainId:'0'

const account = web3.eth.accounts.create()
console.info(account)
web3.eth.getTransactionCount(account.address).then(console.info)
web3.eth.net.getId().then(console.info)

account.signTransaction({
  nonce: '1000',
  gasPrice: '20000000000',
  gas: '21000',
  to: '0x3535353535353535353535353535353535353535',
  value: '1000000000000000000',
  data: ''
}, function (error, response) {
  console.info('error:', error, 'response:', response)
})