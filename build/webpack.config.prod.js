
const webpackBase = require('./webpack.config.base.js')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

let cfg = Object.assign(webpackBase, {
  plugins: [
    new UglifyJSPlugin({
      uglifyOptions: {
        ie8: false,
        ecma: 6,
        mangle: {
          // not work
          reserved: [
            'Buffer',
            'BigInteger',
            'Point',
            'ECPubKey',
            'ECKey',
            'sha512_asm',
            'asm',
            'ECPair',
            'HDNode'
          ]
        }
      }
    })
  ],
  mode: 'production'
});

module.exports = cfg;