
var chai = require('chai');
var should = chai.should();

var fibonacci = function (n) {
    if (n === 0) {
        return 0;
    }
    if (n === 1) {
        return 1;
    }
    return fibonacci(n-1) + fibonacci(n-2);
};

describe('simple test', function () {
    it('1 == 1', function () {
        var i = 1;
        i.should.equal(1);
    });
});