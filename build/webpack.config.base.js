const path = require('path')

module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',

        options: {
          presets: ['env']
        }
      },
    ]
  },

  devtool: 'cheap-module-eval-source-map',
  devServer: {
    contentBase: path.resolve(__dirname, '../test'),
    historyApiFallback: true,
    hot: false
  },

  entry: ['babel-polyfill', path.resolve(__dirname, '../src/index.js')],

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../test')
  },

  mode: 'development'
}
