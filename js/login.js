layui.use('jquery', function() {
    var $ = layui.jquery;

    $(function(){
        $("#login").click(function () {
            $('#u-disk').hide();
            $('#loading').show();
            $('body').removeClass('layui-layout-body');
            $('.login-container').hide();
            $('.main-admin').show();
        });
        $("#logout").click(function () {
            $('body').addClass('layui-layout-body');
            $('.main-admin').hide();
            $('.login-container').show();
        })
    });
});