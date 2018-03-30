/**
 * Created by lenovo on 2018/3/26.
 */
layui.use('form', function(){
    var form = layui.form;

    //º‡Ã˝Ã·Ωª
    form.on('submit(formDemo)', function(data){
        layer.msg(JSON.stringify(data.form));
        return false;
    });
});