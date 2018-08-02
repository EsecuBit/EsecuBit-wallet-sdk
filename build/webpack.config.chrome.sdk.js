const path = require('path')
const webpackBase = require('./webpack.config.dev.js');

let cfg = Object.assign(webpackBase, {
  devtool: 'cheap-module-source-map',
  entry: [path.resolve(__dirname, '../index.js')],

  output: {
    filename: 'eswallet.js',
    path: path.resolve(__dirname, '../dist'),
    library: 'eswallet',
    libraryTarget: 'commonjs2'
  },
});

module.exports = cfg;