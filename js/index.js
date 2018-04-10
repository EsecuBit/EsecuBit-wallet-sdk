/**
 * Created by lenovo on 2018/3/22.
 */
//JavaScript代码区域
layui.use(['jquery','element'], function(){
    var $ = layui.jquery,
        element = layui.element;
    //创建自运行函数
    $(function(){
        //菜单点击事件
        $(".menu-switch li a").click(function(){
            var tabIndex =  $(this).parent().index();
            $(".main-tab-content .layui-show").removeClass("layui-show");
            $(".main-tab-content .main-tab-item").eq(tabIndex).addClass("layui-show");
        })
    });
});