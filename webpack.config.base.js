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
    contentBase: 'test',
    historyApiFallback: true,
    inline: true
  },

  entry: ['babel-polyfill', path.resolve(__dirname, 'src/index.js')],

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'test')
  },

  mode: 'development'
}
