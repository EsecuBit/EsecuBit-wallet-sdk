
import D from '../../sdk/D'
import CoreWallet from '../../sdk/device/CoreWallet'
import JSEncrypt from 'jsencrypt'
import BigInteger from 'bigi'
import chai from 'chai'

chai.should()
describe('CoreWallet', function () {
  let coreWallet

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

  it('doHandShake', async () => {
    // await coreWallet._doHandShake()

    const priKey = '-----BEGIN RSA PRIVATE KEY-----\n' +
      'MIICXQIBAAKBgQDlOJu6TyygqxfWT7eLtGDwajtNFOb9I5XRb6khyfD1Yt3YiCgQ\n' +
      'WMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76xFxdU6jE0NQ+Z+zEdhUTooNR\n' +
      'aY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4gwQco1KRMDSmXSMkDwIDAQAB\n' +
      'AoGAfY9LpnuWK5Bs50UVep5c93SJdUi82u7yMx4iHFMc/Z2hfenfYEzu+57fI4fv\n' +
      'xTQ//5DbzRR/XKb8ulNv6+CHyPF31xk7YOBfkGI8qjLoq06V+FyBfDSwL8KbLyeH\n' +
      'm7KUZnLNQbk8yGLzB3iYKkRHlmUanQGaNMIJziWOkN+N9dECQQD0ONYRNZeuM8zd\n' +
      '8XJTSdcIX4a3gy3GGCJxOzv16XHxD03GW6UNLmfPwenKu+cdrQeaqEixrCejXdAF\n' +
      'z/7+BSMpAkEA8EaSOeP5Xr3ZrbiKzi6TGMwHMvC7HdJxaBJbVRfApFrE0/mPwmP5\n' +
      'rN7QwjrMY+0+AbXcm8mRQyQ1+IGEembsdwJBAN6az8Rv7QnD/YBvi52POIlRSSIM\n' +
      'V7SwWvSK4WSMnGb1ZBbhgdg57DXaspcwHsFV7hByQ5BvMtIduHcT14ECfcECQATe\n' +
      'aTgjFnqE/lQ22Rk0eGaYO80cc643BXVGafNfd9fcvwBMnk0iGX0XRsOozVt5Azil\n' +
      'psLBYuApa66NcVHJpCECQQDTjI2AQhFc1yRnCU/YgDnSpJVm1nASoRUnU8Jfm3Oz\n' +
      'uku7JUXcVpt08DFSceCEX9unCuMcT72rAQlLpdZir876\n' +
      '-----END RSA PRIVATE KEY-----'
    const pubKey = '-----BEGIN PUBLIC KEY-----\n' +
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlOJu6TyygqxfWT7eLtGDwajtN\n' +
      'FOb9I5XRb6khyfD1Yt3YiCgQWMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76\n' +
      'xFxdU6jE0NQ+Z+zEdhUTooNRaY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4\n' +
      'gwQco1KRMDSmXSMkDwIDAQAB\n' +
      '-----END PUBLIC KEY-----'
    const pubKey2 = {
      n: BigInteger.fromHex('e5389bba4f2ca0ab17d64fb78bb460f06a3b4d14e6fd2395d16fa921c9f0f562ddd888281058c356eb8f7cf3b5462621abfcbe62da8b1b97c0bdf962537ae705f92efac45c5d53a8c4d0d43e67ecc4761513a28351698e67662bb93e00c1d040ff64a05448b28bede89b33166d3255031e39b883041ca352913034a65d23240f'),
      // n: 0,
      e: 65537
    }
    console.log(D.test.generateSeed())
    let encrypt = new JSEncrypt()
    encrypt.setPublicKey(pubKey)
    let encrypt2 = new JSEncrypt()
    encrypt2.setPublicKey(pubKey2)
    console.log(encrypt, encrypt2)
    console.log(encrypt.key.n.toString(16))
    console.log(encrypt2.key.n.toString(16))
    // let encrypted = encrypt.encrypt('11111111')
    // console.log(encrypted)
    // console.log(encrypt.key.n.toString(16))
    //
    // let decrypt = new JSEncrypt()
    // decrypt.setPrivateKey(priKey)
    // let decrypted = decrypt.decrypt(encrypted)
    // console.log(decrypted)
    // console.log(decrypt)
  })
})
