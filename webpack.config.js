const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const path = require('path');

console.log(path.resolve(__dirname, '../test'))
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

	devtool:"eval-source-map",
	devServer: {
			contentBase: "../test/",
			historyApiFallback: true,
			inline: true
	},

	plugins: [
		// new UglifyJSPlugin(),
		// new MiniCssExtractPlugin({ filename: 'style.css' })
	],
	entry: ['babel-polyfill',path.resolve(__dirname, '../src/index.js')],

	output: {
		filename: 'sdk.js',
		path: path.resolve(__dirname, '../test')
	},

	mode: 'production'
};
