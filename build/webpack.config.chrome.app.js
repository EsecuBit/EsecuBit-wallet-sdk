
const webpackBase = require('./webpack.config.dev.js');

let cfg = Object.assign(webpackBase, {
  devtool: 'cheap-module-source-map',
});

module.exports = cfg;