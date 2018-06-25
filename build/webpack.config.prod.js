
const webpackBase = require('./webpack.config.base.js')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

let cfg = Object.assign(webpackBase, {
  plugins: [
    new UglifyJSPlugin()
  ],
  mode: 'production'
});

module.exports = cfg;