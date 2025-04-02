const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/static/scratch/'  // 修改这里，指定公共路径
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      inject: true,
      publicPath: '/static/scratch/'  // 添加这行，确保 HTML 中的资源路径正确
    })
  ].concat([
    new CopyWebpackPlugin({
        patterns: [
            {
                from: 'node_modules/scratch-gui/dist/static/blocks-media',
                to: 'static/blocks-media'
            },
            {
                from: 'node_modules/scratch-gui/dist/chunks',
                to: 'chunks'
            },
            {
                from: 'node_modules/scratch-gui/dist/extension-worker.js'
            },
            {
                from: 'node_modules/scratch-gui/dist/extension-worker.js.map'
            },
            {
                from: 'node_modules/scratch-gui/dist/static/assets',
                to: 'static/assets'
            },
            {
                // 修改这里，使用 globOptions 替代 flatten
                from: 'node_modules/scratch-gui/dist/*.hex',
                to: 'static/[name][ext]'  // 使用模板语法替代 flatten
            }
        ]
    })]),
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    historyApiFallback: true,  // 添加这行
    port: 3000,
    hot: true,
    open: false,
  
    client: {
      overlay: false  // 添加这行
    },
    // devMiddleware: {
    //   writeToDisk: true  // 添加这行，让 webpack-dev-server 将文件写入磁盘
    // }
  }
};