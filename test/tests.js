
require("babel-core/register");
require("babel-polyfill");

var should = require('chai').should();

// (async function() {
//     // await解决回调问题，创建一个phantom实例
//     const instance = await phantom.create();
//     //通过phantom实例创建一个page对象，page对象可以理解成一个对页面发起请求和处理结果这一集合的对象
//     const page = await instance.createPage();
//     //页面指向的是哪个一个url
//     await page.on("onResourceRequested", function(requestData) {
//         console.info('Requesting', requestData.url)
//     });
//     //得到打开该页面的状态码
//     const status = await page.open('https://stackoverflow.com/');
//     console.log(status);
// //输出该页面的内容
//     const content = await page.property('content');
//     console.log(content);
//     //输出内容
//     //退出该phantom实例
//     await instance.exit();
// }());

describe('Simple Test', function () {
    it('1 == 1', function () {
        var i = 1;
        i.should.equal(1);
    });

    it('#async test', async function abc() {
        var i = 1;
        i.should.equal(1);
    });
});