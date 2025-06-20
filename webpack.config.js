const path = require('path');

module.exports = {
  entry: {
    service_worker: './src/service_worker.js',
    content: './src/content.js',
     popup: './src/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist/src'),
    filename: '[name].js',
    clean: true
  },
  mode: 'production',
  target: 'web',
  resolve: {
    extensions: ['.js', '.mjs'],
    alias: {
      // Use package.json's module entry points
      '@tensorflow/tfjs-core': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-core'),
      '@tensorflow/tfjs-backend-webgl': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-backend-webgl'),
      '@tensorflow/tfjs-converter': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-converter')
    },
    fallback: {
      path: false,
      fs: false,
      crypto: false,
      util: false,
      buffer: false
    }
  },
  stats: {
    errorDetails: true
  }
};