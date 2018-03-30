/**
 * Created by lenovo on 2018/3/26.
 */
//扩展二维码插件模块
layui.config({
    base: '../statics/extends/'
}).extend({
    qrcode: 'qrcode'
});


layui.use(['form','jquery','qrcode'], function(){
    var form = layui.form,
        $ = layui.jquery;
    $ = layui.qrcode($);
    //生成二维码
    $("#code").qrcode({
        render: "canvas",
        width: 200,
        height:200,
        text: "no no no no no"
    });
    //监听提交
    form.on('select(account)', function(data){
        $("#code").empty().qrcode({
            render: "canvas",
            width: 200,
            height:200,
            text: data.value
        });
    });
});