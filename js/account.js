/**
 * Created by lenovo on 2018/3/22.
 */
layui.use(['jquery'], function(){
    var $ = layui.jquery;
    //创建自运行函数
    $(function(){
        $(".layui-tree li a").click(function(){
            $(".layui-tree li").removeClass("layui-this");
            $(this).parent("li").addClass("layui-this");
        });
        //生成tab
        $(".layui-tree .tab-title").click(function(){
            var tabIndex =  $(this).index();
            $(".tab-content .layui-show").removeClass("layui-show");
            $(".tab-content .tab-item").eq(tabIndex - 1).addClass("layui-show");
        });
    });
});