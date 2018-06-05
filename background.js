
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('old/main.html', {
    'innerBounds': {
      'width': 1000,
      'height': 800,
      'minWidth': 1000,
      'minHeight': 800
    },
    'id': "ChromeApps-Sample-USB-DeviceInfo"
  });
});