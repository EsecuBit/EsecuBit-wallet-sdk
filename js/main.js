/**
 * Created by lenovo on 2018/4/8.
 */



var Wallet = require('../sdk/wallet');
var D = require('../sdk/def');
var deviceId = "default";
var passPhraseId = "BA3253876AED6BC22D4A6FF53D8406C6AD864195ED144AB5C87621B6C233B548";
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
        
        //设定全局对象
        var common ={
            getFormatTime : function(date) {
                var date = new Date(date);
                var yyyy = date.getFullYear();
                var moth = date.getMonth() + 1;
                var MM = parseInt(moth / 10) ? moth : "0" + moth;
                var dd = parseInt(date.getDate() / 10) ? date.getDate() : "0"
                    + date.getDate();
                var HH = parseInt(date.getHours() / 10) ? date.getHours() : "0"
                    + date.getHours();
                var mm = parseInt(date.getMinutes() / 10) ? date.getMinutes() : "0"
                    + date.getMinutes();
                var ss = parseInt(date.getSeconds() / 10) ? date.getSeconds() : "0"
                    + date.getSeconds();
                var arr = [];
                arr.push(yyyy);
                arr.push("-");
                arr.push(MM);
                arr.push("-");
                arr.push(dd);
                arr.push(" ");
                arr.push(HH);
                arr.push(":");
                arr.push(mm);
                arr.push(":");
                arr.push(ss);
                return arr.join("");
            }
        };

        //获取信息
        var accountInformation = [],
            setGlobalAccount ={},
            accountAddress = [];

        wallet.listenDevice(function (error, isPlugIn) {
            if(isPlugIn){
                console.log(231)
            }
            console.log('plug out');
            if (!isPlugIn) {
                return;
            }
            console.log('listenDevice: error ' + error + ', isPlugIn ' + isPlugIn);

            //跳转
            $('#u-disk').hide();
            $('#loading').show();
            $('#warnMsg').text("Loading... please wait a moment");
            $('#admin_app').removeClass('layui-layout-body');
            $('.login-container').hide();
            $('.main-admin').show();



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

            wallet.getAccounts(deviceId, passPhraseId, function (error, accounts) {

                //业务逻辑
                accountInformation = accounts;
                if (error !== D.ERROR_NO_ERROR) {
                    return;
                }
                console.log(accounts);
                //业务逻辑代码
                for(var i=0;i<accounts.length;i++){
                    setGlobalAccount[accounts[i].accountId] = accounts[i];
                    var account = accounts[i];
                    account.getAddress({}, function (error, address){
                        accountAddress.push(address);
                    });
                }
                console.log(setGlobalAccount);
                //渲染表单
                $("select[name='receiveAccount']").empty();
                $("select[name='account']").empty();

                $.each(accountInformation,function (i,val) {
                    //分页表格
                    if(i===0){
                        var accountDomFirst = '<li class="site-tree-noicon tab-title-1 layui-this"><a href="#"><cite>'+ val.label+'</cite><em>'+ val.label+'</em></a></li>';
                        var accountDmoFirst = '<div class="tab-item layui-show"><div class="site-title"><fieldset><legend><a name="default">Recent Operations</a></legend></fieldset></div><div class="layui-row">' +
                            '<div class="layui-col-xs12 ">' + '<div id='+ 'table-content-'+i+'></div></div></div></div>';
                        $("#account_tree").append(accountDomFirst);
                        $('#tab-content-1').append(accountDmoFirst);

                        gridList(i,val);
                    }else {
                        var accountDom = '<li class="site-tree-noicon tab-title-1"><a href="#"><cite>'+ val.label+'</cite><em>'+ val.label+'</em></a></li>';
                        var accountDmo = '<div class="tab-item"><div class="site-title"><fieldset><legend><a name="default">Recent Operations</a></legend></fieldset></div><div class="layui-row">\n' +
                            '<div class="layui-col-xs12 "><div id='+ 'table-content-'+i+'></div></div></div></div>';
                        $("#account_tree").append(accountDom);
                        $("#tab-content-1").append(accountDmo);

                        gridList(i,val);
                    }
                    //独立各tab操作
                    $(".tab-title-1 a").click(function(){
                        $(".tab-title-1").removeClass("layui-this");
                        $(this).parent("li").addClass("layui-this");
                        var parentIndex=$(this).parent().parent().index();
                        var tabIndex =  $(this).parent().index()+parentIndex*3;
                        $(".tab-content-1 .layui-show").removeClass("layui-show");
                        $(".tab-content-1 .tab-item").eq(tabIndex - 1).addClass("layui-show");
                    });


                    $("select[name='receiveAccount']").append('<option value="'+ accountAddress[i].qrAddress+'">'+val.label+'</option>');
                    $("select[name='account']").append('<option value="'+ val.accountId+'">'+val.label+'</option>');
                } );
                form.render('select', 'form2');
                form.render('select', 'form1');
                $(".layui-form-select .layui-anim-upbit .dd").removeClass("layui-this");
                //生成二维码
                $("#code").qrcode({
                    render: "canvas",
                    width: 200,
                    height:200,
                    text: accountAddress[0].qrAddress
                });



            });
        });

        $("#logout").click(function () {
            $('#admin_app').addClass('layui-layout-body');
            $('.main-admin').hide();
            $('.login-container').show();
        });

        //菜单点击事件
        $(".menu-switch li a").click(function(){
            $("#message").text($(this).text());
            var tabIndex =  $(this).parent().index();
            $(".main-tab-content .main-tab-item").removeClass("layui-show").eq(tabIndex).addClass("layui-show");
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



        var page= 1,limit=10,
            rows=[
                {id:1,
                    name:"Account",
                    address:"adasdasdasda",
                    count:"25",
                    time:1523525292000,
                    money:"0.01"}
            ];

        //生成表格函数
        function gridList(i,val){
            //分页参数
            var startItem = limit*(page-1),
                endItem = limit*(page-1)+limit-1;
            val.getTransactionInfos(startItem, endItem, function (error, total, transactions) {
                console.log(total);
                console.log(transactions);
                //清空表格并且重载
                $("#table-content-"+i).empty().append('<table id='+ 'tab_'+ i +'></table><div id='+'grid-pager-'+i+'></div>');

                //设置响应式宽度布局
                var grid_selector = "#tab_"+ i,
                    parent_column = $(grid_selector).closest('[class*="layui-col-xs12"]');
                //resize to fit page size
                // $(window).on('resize.jqGrid', function() {
                //     $(grid_selector).jqGrid('setGridWidth', parent_column.width());
                // });
                $(grid_selector).jqGrid('setGridWidth', "715px");

                $(grid_selector).jqGrid({
                    data:transactions,
                    datatype: "local",
                    height: "100%",
                    colNames: ['Id', 'coinType','count', 'Date','Direction'],
                    colModel: [{
                        name: 'accountId',
                        index: 'accountId',
                        width: 160
                    }, {
                        name: 'coinType',
                        index: 'coinType',
                        sortable:false,
                        width: 180
                    }, {
                        name: 'count',
                        index: 'count',
                        sortable:false,
                        width: 180,
                        formatter:function (value) {
                            return value/100000000+'   ' + '<em>BTC</em>'
                        }
                    }, {
                        name: 'createTime',
                        index: 'createTime',
                        sortable:false,
                        width: 180,
                        formatter:function (value) {
                            return common.getFormatTime(value)
                        }
                    }, {
                        name: 'direction',
                        index: 'direction',
                        sortable:false,
                        width: 150
                    }],
                    autowidth: true,
                    multiselect: true,
                    multiboxonly: true,
                    styleUI:'Bootstrap',
                    gridComplete:function(){
                        //隐藏grid底部滚动条
                        $(grid_selector).closest(".ui-jqgrid-bdiv").css({ "overflow-x" : "hidden" });
                    }
                });
                $(window).triggerHandler('resize.jqGrid'); //trigger window resize to make the grid get2 the correct size
                pageList(total);
                function pageList(total){
                    laypage.render({
                        elem: 'grid-pager-'+i,
                        count: total,
                        limit:10,
                        curr:page,
                        prev:"prev",
                        next:"next",
                        first:"first",
                        last:"last",
                        layout:['prev', 'page', 'next','count'],
                        jump: function(obj, first){
                            //obj包含了当前分页的所有参数，比如：
                            console.log(obj.curr); //得到当前页，以便向服务端请求对应页的数据。
                            console.log(obj.limit); //得到每页显示的条数
                            //首次不执行
                            if(!first){
                                limit=obj.limit;
                                page=obj.curr;
                                gridList(i,val);
                            }
                        }
                    });
                }

            });

        }

        
        //send.html页面
        var addAddress =function(){
            $(".money-address").append('<div class="layui-form-item">'+
                '<label class="layui-form-label"></label>'+
                '<div class="layui-input-inline input-width">'+
                '<input type="text" name="address"  placeholder="Bitcoin Address" autocomplete="off" class="layui-input">'+
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
                var curretAddress = $(this).val();
                if(curretAddress){
                    addressArray.push(curretAddress);
                }
            });
            return addressArray;
        };
        //新增表单验证
        form.verify({
            money:function(value,item){
                if(value>200){
                    return "The transaction amount cannot exceed 200"
                }
                if(/[^\-?\d.]/.test(value)){
                    return "The amount of the transaction can only be a number"
                }
            }
        });
        $("#money").keyup(function () {
            var c=$(this);
            if(/[^\d]/.test(c.val())){//替换非数字字符
                var temp_amount=c.val().replace(/[^\-?\d.]/g,'');
                $(this).val(temp_amount);
            }
        });
        $("#money").blur(function () {
            var c=$(this);
            if(/[^\d]/.test(c.val())){//替换非数字字符
                var temp_amount=c.val().replace(/[^\-?\d.]/g,'');
                $(this).val(temp_amount);
            }
        });
        var fastFee= wallet.getFloatCount(wallet.getFee("fast")),
            normalFee= wallet.getFloatCount(wallet.getFee("normal")),
            economyFee= wallet.getFloatCount(wallet.getFee("economy"));
        var feeDom ='<option value="'+ fastFee +'">Fast（fast confirmation）</option>\n' +
            '<option value="'+normalFee +'">Normal（normal confirmation）</option>\n' +
            '<option value="'+ economyFee+'">Low（slow confirmation）</option>\n' +
            '<option value="0">Custome fees</option>';
        $("select[name='fee']").empty().append(feeDom);
        form.render('select', 'form1');
        //监听选择
        form.on('select(fee)', function(data){
            var amount = $('input[name="money"]').val();
            var total = (Number(amount)*100000000 + Number(data.value)*100000000)/100000000;
            $("textarea").val("BTC "+ total+"(BTC "+ data.value+"Transaction Fees)");

        });
        $('input[name="money"]').change(function () {
            var selectFee= $("select[name='fee'] option:selected").val();
            var amount = $('input[name="money"]').val();
            var total = (Number(amount)*100000000 + Number(selectFee)*100000000)/100000000;
            $("textarea").val("BTC "+ total+"(BTC "+ selectFee+"    Transaction Fees)");
        });
        //监听提交
        form.on('submit(formDemo)', function(data){
            var getAccount = setGlobalAccount[data.field.account];
            var formData ={
                out:Number(data.field.money)*100000000,
                addresses:getAddress(),
                fee:Number(data.field.fee)*100000000
            };
            getAccount.sendBitCoin( formData,function () {
                layer.msg("successfull",{icon:1});
            });
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

