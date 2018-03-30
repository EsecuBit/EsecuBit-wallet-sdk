layui.use('jquery', function() {
    var $ = layui.jquery;
    //opts 样式可从网站在线制作
    //opts 样式可从网站在线制作
    var opts = {
        lines: 10, // 花瓣数目
        length: 4, // 花瓣长度
        width: 5, // 花瓣宽度
        radius: 8, // 花瓣距中心半径
        corners: 1, // 花瓣圆滑度 (0-1)
        rotate: 0, // 花瓣旋转角度
        direction: 1, // 花瓣旋转方向 1: 顺时针, -1: 逆时针
        color: '#000', // 花瓣颜色
        speed: 1, // 花瓣旋转速度
        trail: 60, // 花瓣旋转时的拖影(百分比)
        shadow: false, // 花瓣是否显示阴影
        hwaccel: false, //spinner 是否启用硬件加速及高速旋转
        className: 'spinner', // spinner css 样式名称
        zIndex: 2e9, // spinner的z轴 (默认是2000000000)
        top: '50%', // spinner 相对父容器Top定位 单位 px
        left: '50%'// spinner 相对父容器Left定位 单位 px
    };

    var spinner = new Spinner(opts);

    $(document).ready(function () {
        $("#btnRequest").bind("click", function () {
            Request();
        });
        $("#btnRequest2").bind("click", function () {
            Request2();
        });
    });

    function Request(){
        //请求时spinner出现
        var target = $("#firstDiv").get(0);
        $("#firstDiv").empty();
        $("#warnMsg").text("正在打开比特币钱包，请耐心等待....");
        spinner.spin(target);
    }

    function Request2(){
        //关闭spinner
        spinner.spin();
        $("#firstDiv").empty().append('<i class="icon iconfont icon-thumbDrive" style="font-size: 50px">');
        $("#warnMsg").text("请在电脑上插上你的key并解锁你的钱包");
    }
});