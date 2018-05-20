
console.log('start es hid device test')

var EsHidDevice = require('../../sdk/device/EsHidDevice').class
var D = require('../../sdk/D')

var device = new EsHidDevice()

device.listenPlug(function (error, isPlugIn) {
  console.log('error ' + error + ', isPlugIn: ' + isPlugIn)

  if (isPlugIn) {
    // var apdu = '007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138'
    // console.log('test send ' + apdu)
    // device.sendAndReceive(hexToArrayBuffer(apdu), function (error, receive) {
    //   if (error !== D.ERROR_NO_ERROR) {
    //     return
    //   }
    //   console.log('test receive ' + arrayBufferToHex(receive))
    // })

    // var apdu = '8033000007ba050000000000'
    // console.log('test send ' + apdu)
    // device.sendAndReceive(hexToArrayBuffer(apdu), function (error, receive) {
    //   if (error !== D.ERROR_NO_ERROR) {
    //     return
    //   }
    //   console.log('test receive ' + arrayBufferToHex(receive))
    // })
  }
})

var x = document.getElementById("submit")
x.onclick = doit
function doit() {
  var apdu = '007800002E09302e303132204254430122314d6459433232476d6a7032656a5670437879596a66795762514359544768477138'
  console.log('test send ' + apdu)
  device.sendAndReceive(hexToArrayBuffer(apdu), function (error, receive) {
    if (error !== D.ERROR_NO_ERROR) {
      return
    }
    console.log('test receive ' + arrayBufferToHex(receive))
  })
}

function arrayBufferToHex(array) {
  var hexChars = '0123456789ABCDEF'
  var hexString = new Array(array.byteLength * 2)
  var intArray = new Uint8Array(array)

  for (var i = 0; i < intArray.byteLength; i++) {
    hexString[2 * i] = hexChars.charAt((intArray[i] >> 4) & 0x0f)
    hexString[2 * i + 1] = hexChars.charAt(intArray[i] & 0x0f)
  }
  return hexString.join('')
}

function hexToArrayBuffer(hex) {
  var result = new ArrayBuffer(hex.length / 2)
  var hexChars = '0123456789ABCDEFabcdef'
  var res = new Uint8Array(result)
  for (var i = 0; i < hex.length; i += 2) {
    if (hexChars.indexOf(hex.substring(i, i + 1)) === -1) break
    res[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return result
}
