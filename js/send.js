/**
 * Created by lenovo on 2018/3/26.
 */
layui.use(['form','jquery'], function(){
    var form = layui.form,
        $=layui.jquery;
    var addAddress =function(){
        $(".money-address").append('<div class="layui-form-item">'+
            '<label class="layui-form-label"></label>'+
            '<div class="layui-input-inline" style="width: 600px">'+
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
});