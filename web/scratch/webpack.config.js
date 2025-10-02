const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/static/scratch/'  // 修改这里，指定公共路径
  },
  // 添加 resolve 配置到模块导出对象内部
  resolve: {
    alias: {
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    }
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
      template: process.env.NODE_ENV === 'production' 
        ? './public/index.html.template' 
        : './public/index.html',
      filename: 'index.html',
      inject: true,
    })
  ].concat([
    new CopyWebpackPlugin({
        patterns: [
            {
                from: 'node_modules/scratch-gui/dist/static/blocks-media',
                // Remove "scratch" from the path to match URL structure
                to: 'static/blocks-media'
            },
            {
                from: 'node_modules/scratch-gui/dist/chunks',
                to: 'static/chunks'
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
              from: 'public/static/assets',
              to: 'static/assets'
            },
            {
                // 修改这里，使用 globOptions 替代 flatten
                from: 'node_modules/scratch-gui/dist/*.hex',
                to: 'static/[name][ext]'  // 使用模板语法替代 flatten
            }
        ]
    }),
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.js$/i,
      threshold: 10 * 1024,
      minRatio: 0.8,
      deleteOriginalAssets: true,
    })
  ]),
  devServer: {
    static: {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/scratch/'  // Update to match the URL path
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/static\/scratch/, to: '/static/scratch/index.html' }
      ]
    },
    port: 3000,
    hot: true,
    open: false,
    client: {
      overlay: false
    },
    devMiddleware: {
      publicPath: '/static/scratch/'
    }
  }
};