/**
 * Created by lenovo on 2018/3/22.
 */
//JavaScript代码区域
layui.use(['jquery','element'], function(){
    var $ = layui.jquery,
        element = layui.element;
    //创建自运行函数
    $(function(){
        //iframe的高度自适应问题
        $(window).on('resize', function() {
            var $content = $('.content');
            $content.height($(this).height() - 120);
            $content.find('iframe').each(function() {
                $(this).height($content.height());
            });
        }).resize();
        //菜单点击事件
        $("#menu-switch li a").click(function(){
            var url = $(this).data("url");
            $("#myiframe").attr('src', url);
        })
    });
});