var webpack = require("webpack");
var webpackBase = require("./webpack.config.base.js");

var cfg = Object.assign(webpackBase, {
  devtool: "cheap-module-eval-source-map"
});

module.exports = cfg;