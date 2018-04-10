
console.log('start es hid device test');
var EsHidDevice = require('../sdk/hardware/es_hid_device');

var device = new EsHidDevice();

device.listenPlug(function (error, isPlugIn) {
    console.log('error ' + error + ', isPlugIn: ' + isPlugIn);
});