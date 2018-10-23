const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve('dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          path.join(__dirname, "..", "..", "dist"),
          'babel-loader',
        ],
      },
    ],
  },
};
