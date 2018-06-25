
const webpackBase = require('./webpack.config.base.js');

let cfg = Object.assign(webpackBase, {
  devtool: 'cheap-module-source-map',
});

module.exports = cfg;