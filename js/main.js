/**
 * Created by lenovo on 2018/4/8.
 */



var Wallet = require('../sdk/wallet');
var D = require('../sdk/def');

var deviceID = "default";
var passPhraseID = "BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548";
var coinType = D.COIN_BIT_COIN;
var wallet = new Wallet();
//JavaScript代码区域

//扩展二维码插件模块
layui.config({
    base: './statics/extends/'
}).extend({
    jqGrid: 'jquery.jqGrid',
    localeEn:'grid.locale-en',
    qrcode: 'qrcode'
});
layui.use(['jquery','form','jqGrid','localeEn','laypage','element','qrcode'], function(){
    var $ = layui.jquery,
        form=layui.form,
        element = layui.element,
        laypage = layui.laypage,
        $ = layui.qrcode($),
        $ = layui.jqGrid($);

    //创建自运行函数
    $(function(){

        //获取信息
        var accountInformation = [],
            accountAddress = [];

        wallet.listenDevice(function (error, isPlugIn) {
            if (!isPlugIn) {
                return;
            }

            wallet.getWalletInfo(function (error, info) {
                //获取硬件信息
                $.each(info,function (i,val) {
                    $("#hardwareInformation").append('<tr><td>'+val.name +'</td><td>'+ val.value+'</td></tr>');
                });
                console.log(info);
                if (error !== D.ERROR_NO_ERROR) {
                    return;
                }
            });

            wallet.getAccounts(deviceID, passPhraseID, function (error, accounts) {

                //业务逻辑
                accountInformation = accounts;
                if (error !== D.ERROR_NO_ERROR) {
                    return;
                }
                //业务逻辑代码
                for(var i=0;i<accounts.length;i++){
                    var account = accounts[i];
                    account.getAddress({}, function (error, address){
                        accountAddress.push(address);
                    });
                }

                //渲染表单
                $.each(accountInformation,function (i,val) {
                    $("select[name='account']").append('<option value="'+ accountAddress[i].qrAddress+'">'+val.label+'</option>')
                } );
                form.render('select');
                //生成二维码
                $("#code").qrcode({
                    render: "canvas",
                    width: 200,
                    height:200,
                    text: accountAddress[0].qrAddress
                });



            });
        });

        //登录
        $("#login").click(function () {
            $('#u-disk').hide();
            $('#loading').show();
            $('#admin_app').removeClass('layui-layout-body');
            $('.login-container').hide();
            $('.main-admin').show();
            gridList();
        });
        $("#logout").click(function () {
            $('#admin_app').addClass('layui-layout-body');
            $('.main-admin').hide();
            $('.login-container').show();
        });

        //菜单点击事件
        $(".menu-switch li a").click(function(){
            $("#message").val($(this).text());
            var tabIndex =  $(this).parent().index();
            $(".main-tab-content .main-tab-item").removeClass("layui-show").eq(tabIndex).addClass("layui-show");
        });

        //独立各tab操作
        $(".tab-title-1 a").click(function(){
            $(".tab-title-1").removeClass("layui-this");
            $(this).parent("li").addClass("layui-this");
            var parentIndex=$(this).parent().parent().index();
            var tabIndex =  $(this).parent().index()+parentIndex*3;
            $(".tab-content-1 .layui-show").removeClass("layui-show");
            $(".tab-content-1 .tab-item").eq(tabIndex - 1).addClass("layui-show");
        });

        //切换tab操作
        $(".tab-title-2 a").click(function(){
            $(".tab-title-2").removeClass("layui-this");
            $(this).parent("li").addClass("layui-this");
            var parentIndex=$(this).parent().parent().index();
            var tabIndex =  $(this).parent().index()+parentIndex*3;
            $(".tab-content-2 .layui-show").removeClass("layui-show");
            $(".tab-content-2 .tab-item").eq(tabIndex - 1).addClass("layui-show");
        });



        var page= 1,total=20,limit=10,
            rows=[
                {id:1,
                    name:"账户一",
                    address:"adasdasdasda",
                    count:"25",
                    time:"2018-4-3",
                    money:"0.01"}
            ];

        //生成表格函数
        function gridList(){
            //清空表格并且重载
            $("#table-content").empty().append('<table id="grid-table"></table><div id="grid-pager"></div>');

            //设置响应式宽度布局
            var grid_selector = "#grid-table",
                parent_column = $(grid_selector).closest('[class*="layui-col-xs12"]');
            //resize to fit page size
            $(window).on('resize.jqGrid', function() {
                $(grid_selector).jqGrid('setGridWidth', parent_column.width());
            });

            $("#grid-table").jqGrid({
                data: rows,
                datatype: "local",
                height: "100%",
                colNames: ['ID', '账户','比特币地址', '计数器值', '发起时间','金额'],
                colModel: [{
                    name: 'id',
                    index: 'id',
                    width: 30
                }, {
                    name: 'name',
                    index: 'name',
                    sortable:false,
                    width: 60
                }, {
                    name: 'address',
                    index: 'address',
                    sortable:false,
                    width: 60
                }, {
                    name: 'count',
                    index: 'count',
                    sortable:false,
                    width: 60
                }, {
                    name: 'time',
                    index: 'time',
                    sortable:false,
                    width: 60
                }, {
                    name: 'money',
                    index: 'money',
                    sortable:false,
                    width: 60
                }],
                autowidth: true,
                multiselect: true,
                multiboxonly: true,
                styleUI:'Bootstrap',
                gridComplete:function(){
                    //隐藏grid底部滚动条
                    $("#grid-table").closest(".ui-jqgrid-bdiv").css({ "overflow-x" : "hidden" });
                }
            });
            $(window).triggerHandler('resize.jqGrid'); //trigger window resize to make the grid get the correct size
            pageList();
        }
        function pageList(total){
            laypage.render({
                elem: 'grid-pager',
                count: 50,
                limit:limit,
                curr:page,
                layout:['prev', 'page', 'next','skip','limit','count'],
                jump: function(obj, first){
                    //obj包含了当前分页的所有参数，比如：
                    console.log(obj.curr); //得到当前页，以便向服务端请求对应页的数据。
                    console.log(obj.limit); //得到每页显示的条数
                    //首次不执行
                    if(!first){
                        limit=obj.limit;
                        page=obj.curr;
                        gridList();
                    }
                }
            });
        }

        //send.html页面
        var addAddress =function(){
            $(".money-address").append('<div class="layui-form-item">'+
                '<label class="layui-form-label"></label>'+
                '<div class="layui-input-inline input-width">'+
                '<input type="text" name="address" lay-verify="required" placeholder="比特币地址" autocomplete="off" class="layui-input">'+
                '</div>'+
                '</div>')
        };
        //监听事件
        $("input[name='money']").change(function(){

        });
        //获取最大的金额
        $("#max").click(function(e){
            e.preventDefault();
            $("input[name='money']").val(200);
        });
        //添加多个地址
        $("#addAddress").click(function(e){
            e.preventDefault();
            addAddress();
        });
        //获取地址
        var getAddress=function(){
            var addressArray=[];
            $("input[name='address']").each(function(index,element){
                addressArray.push($(this).val());
            });
            return addressArray;
        };
        //新增表单验证
        form.verify({
            money:function(value,item){
                if(value>200){
                    return "交易的金额不能大于200"
                }
                if(/[^\-?\d.]/.test(value)){
                    return "交易的金额只能为数字"
                }
            }
        });
        //监听提交
        form.on('submit(formDemo)', function(data){
            var formData ={
                money:data.field.money,
                address:getAddress(),
                account:data.field.account,
                fee:data.field.fee
            };

            layer.msg(JSON.stringify(formData));
            return false;
        });


        //accept.html文件


        $("#change_address").click(function(e){
            e.preventDefault();
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
        ////setting
        form.on('select(lang)', function(data){


        });
    });
});

