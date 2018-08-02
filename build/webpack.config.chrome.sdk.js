const path = require('path')
const webpackBase = require('./webpack.config.dev.js');

let cfg = Object.assign(webpackBase, {
  devtool: 'cheap-module-source-map',
  entry: ['babel-polyfill', path.resolve(__dirname, '../index.js')],
});

module.exports = cfg;