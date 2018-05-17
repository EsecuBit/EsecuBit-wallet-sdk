const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const path = require('path');

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
			{
					test: /\.(js|vue)$/,
					loader: 'eslint-loader',
					enforce: 'pre',
					include: [path.resolve(__dirname, 'test'), path.resolve(__dirname, 'test')],
					options: {
							formatter: require('eslint-friendly-formatter'),
					}
			},
			{
				test: /\.css$/,

				use: [
					{
						loader: MiniCssExtractPlugin.loader
					},
					{
						loader: 'css-loader',

						options: {
							sourceMap: true
						}
					}

				]
			},
		]
	},

    devtool:"eval-source-map",
    devServer: {
        contentBase: "./test/", //本地服务器所加载的页面所在的目录
        historyApiFallback: true, //不跳转
        inline: true //实时刷新
    },

	plugins: [
		new UglifyJSPlugin(),
		new MiniCssExtractPlugin({ filename: 'style.css' })
	],
	entry: ['babel-polyfill', __dirname + '/src/index.js'],

	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'test')
	},

	mode: 'production'
};
