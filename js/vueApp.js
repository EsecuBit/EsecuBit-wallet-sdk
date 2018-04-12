var i18n=new VueI18n({
    locale: "en",
    messages:{
        "en":{
            title:"Wallet Bitcion",
            description:"A secure offline management tool",
            message:"Please insert your key on your computer and unlock your wallet",
            contact_us:"If you need help, please contact us.",
            Account:"Accounts",
            Send:"Send",
            Accept:"Accept",
            Setting:"Setting",
            Logout:"Logout",
            home:"Home",
            recentOperations:"Recent Operations",
            promptMessage:"Make sure you have the correct beneficiary address！",
            sendBitcoins:"Send Bitcoins",
            amount:"Amount",
            receiverAddress:"Bitcoin Address",
            addAddress:"Add",
            chooseAccount:"Choose an Account",
            transactionFee:"Transaction Fees",
            totalFees:"Total Fees",
            submit:"Submit",
            reset:"Reset",
            selectAcconutToQR:"Select an account to generate QR code",
            receiveBitcoins: "Receive Bitcoins",
            sendDescription:"Please use the mobile phone to scan the QR code in the picture",
            display:"display",
            hardwareInformation:"hardware information",
            selectLang:"Interface Language"
        },
        "zh-CN":{
            title:"比特币钱包",
            description:"一套安全的离线管理工具",
            message:"请在电脑上插上你的key并解锁你的钱包",
            contact_us:"如果有疑问，请联系我们。",
            Account:"账户",
            Send:"发送",
            Accept:"接收",
            Setting:"设置",
            Logout:"退出",
            home:"首页",
            recentOperations:"最近的操作",
            promptMessage:"请填写一个正确有效的地址",
            sendBitcoins:"发送比特币",
            amount:"金 额",
            receiverAddress:"收件人地址",
            addAddress:"添加",
            chooseAccount:"选择账户",
            transactionFee:"交易费用",
            totalFees:"总花费",
            submit:"提交",
            reset:"重置",
            selectAcconutToQR:"选择一个账户生成二维码",

            receiveBitcoins: "接收比特币",
            sendDescription:"请扫描图中的二维码发送比特币",
            display:"显示",
            hardwareInformation:"硬件信息",
            selectLang:"选择语言"




        }
    }
});
var vm = new Vue({
    el:'#admin_app',
    i18n,
    data:function () {
        var that=this;
        return{
            navTitle:"Accout",
            home:that.$t('home')
        }
    }
});