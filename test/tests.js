
function get(url, errorCallback, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
                try {
                    var coinInfo = JSON.parse(xmlhttp.responseText);
                    callback(coinInfo);
                } catch (e) {
                    console.warn(e);
                }
            } else if (xmlhttp.status === 500) {
                console.warn('http get error', url, xmlhttp.status);
            } else {
                console.warn('http get error', url, xmlhttp.status);
            }
        }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.setRequestHeader('Content-type', 'application/json');
    xmlhttp.send();
}

var url = 'https://bitcoinfees.earn.com/api/v1/fees/recommended';
get(url, function (error) {
    console.warn('request fee failed', url, error);
}, function (response) {
    console.info('new fee', response);
});