
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import JSEncrypt from 'jsencrypt'
import chai from 'chai'

chai.should()
describe('CoreWallet', function () {
  let coreWallet
  this.timeout(100000)

  it('init', () => {
    D.test.mockDevice = true
    coreWallet = new CoreWallet()
  })

  it('listenPlug', function (done) {
    coreWallet.listenPlug((error, status) => {
      error.should.equal(D.error.succeed)
      if (status === D.status.plugIn) {
        done()
      }
    })
  })

  it('getRandom', async () => {
    let response = await coreWallet.getRandom(8)
    response.byteLength.should.equal(8)
  })

  it('getRandom by enc apdu', async () => {
    let response = await coreWallet._sendApdu('803300000EB60C000000000000000000000000', true)
    console.log('got response', D.toHex(response))
    //
    // var CryptoJS = require('crypto-js')
    // var input = CryptoJS.lib.WordArray.create(new Uint8Array(D.toBuffer('02000000AA5F4336939CB4186FF1E5119D3E93D1A33C72EED1F40718149B9B240C9DF300510C30C631FD583CA99CEA2956B7A4549797FCE307D3132AD599904389C0411791FEFC3214B55F1ECD615EDCF5A409184C7D30CEB31905B9007482A74815F8422195D4B4A64B43131A4A04424F14EE46BA5146FC9DB2B1A306760CEC597FBD6FB1D74CE65A02C3C3C64B589EFD87C5016A3B3CB67201D65A257CBA7D9D29FC4F5BE20FB8C50DD36188B213360010457AFE97286B8833AFC62148820DC133B58E14D2FE57F3D6B6C5A46BC9B454A793310FEDDF7557D14743DBFEBB90FBA8F9A7A5CA2500765AB02D5521AC56DDDC419F808197601A4C1A694B5914138A78F35897F6675061EE11B79F1BB3472451D03FB89300F60EE56213D9D675155AD1428DAB3850237D5D6EE39F35E6EDD1546EDBC735862A537C080BC40959107CBA94F2C1C7C7B3886CE12293BD7BDC6B4247CAA50FF3698A2A367F1A896E8C7274055A22E953E63B73189024DBBA9E67E3814E190321A98EB181D05C51DF275C7BFD57')));
    // var plaintext = CryptoJS.SHA1(input)
    // console.log(plaintext.toString());
    // console.log(new ArrayBuffer().hello());

    // const priKey = '-----BEGIN RSA PRIVATE KEY-----\n' +
    //   'MIICXQIBAAKBgQDlOJu6TyygqxfWT7eLtGDwajtNFOb9I5XRb6khyfD1Yt3YiCgQ\n' +
    //   'WMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76xFxdU6jE0NQ+Z+zEdhUTooNR\n' +
    //   'aY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4gwQco1KRMDSmXSMkDwIDAQAB\n' +
    //   'AoGAfY9LpnuWK5Bs50UVep5c93SJdUi82u7yMx4iHFMc/Z2hfenfYEzu+57fI4fv\n' +
    //   'xTQ//5DbzRR/XKb8ulNv6+CHyPF31xk7YOBfkGI8qjLoq06V+FyBfDSwL8KbLyeH\n' +
    //   'm7KUZnLNQbk8yGLzB3iYKkRHlmUanQGaNMIJziWOkN+N9dECQQD0ONYRNZeuM8zd\n' +
    //   '8XJTSdcIX4a3gy3GGCJxOzv16XHxD03GW6UNLmfPwenKu+cdrQeaqEixrCejXdAF\n' +
    //   'z/7+BSMpAkEA8EaSOeP5Xr3ZrbiKzi6TGMwHMvC7HdJxaBJbVRfApFrE0/mPwmP5\n' +
    //   'rN7QwjrMY+0+AbXcm8mRQyQ1+IGEembsdwJBAN6az8Rv7QnD/YBvi52POIlRSSIM\n' +
    //   'V7SwWvSK4WSMnGb1ZBbhgdg57DXaspcwHsFV7hByQ5BvMtIduHcT14ECfcECQATe\n' +
    //   'aTgjFnqE/lQ22Rk0eGaYO80cc643BXVGafNfd9fcvwBMnk0iGX0XRsOozVt5Azil\n' +
    //   'psLBYuApa66NcVHJpCECQQDTjI2AQhFc1yRnCU/YgDnSpJVm1nASoRUnU8Jfm3Oz\n' +
    //   'uku7JUXcVpt08DFSceCEX9unCuMcT72rAQlLpdZir876\n' +
    //   '-----END RSA PRIVATE KEY-----'
    // const pubKey = '-----BEGIN PUBLIC KEY-----\n' +
    //   'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlOJu6TyygqxfWT7eLtGDwajtN\n' +
    //   'FOb9I5XRb6khyfD1Yt3YiCgQWMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76\n' +
    //   'xFxdU6jE0NQ+Z+zEdhUTooNRaY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4\n' +
    //   'gwQco1KRMDSmXSMkDwIDAQAB\n' +
    //   '-----END PUBLIC KEY-----'
    //
    // let encrypt = new JSEncrypt()
    // const time = new Date().getTime()
    // encrypt.getKey()
    // encrypt.setPublicKey(pubKey)
    // let encrypted = encrypt.encrypt('11111111')
    // console.log(encrypted)
    // console.log(encrypt.key.n.toString(16))
    //
    // // let decrypted = encrypt.decrypt(encrypted)
    // // console.log(decrypted)
    // // console.log(encrypt)
    //
    // const factoryPubKey = D.toBuffer(
    //   'B721A1039865ABB07039ACA0BC541FBE' +
    //   '1A4C3FF707619F68FCCD1F59CACC39D2' +
    //   '310A5BA1E8B39E179E552E97B305854C' +
    //   '0276E356AFE06ED6FD9A1969FE9B3EBC' +
    //   '9889A5C5F00498449FA41EE12FB3BE21' +
    //   '40F3DAFFBF4075ECDF8C04DF343BB853' +
    //   '47D39C6B7739DFD5AD81BB2E09ADCDC1' +
    //   '7959A89E7617E297B0AEB6DFA084E5E1')
    // console.log(D.toHex(factoryPubKey))
  })
})
