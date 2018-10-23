const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function digest(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

const generate = (depPath, callback) => {
  return fs.readFile(depPath, (err, content) => {
    if (err) {
      return callback(err);
    } else {
      return callback(null, {
        path: depPath,
        digest: digest(content)
      });
    }
  });
}

const compare = (data, callback) => {
  return fs.readFile(data.depPath, (err, content) => {
    if (err) {
      return callback(err);
    } else if (digest(content) !== data.digest) {
      // file is invalid
      return callback(true);
    } else {
      return callback();
    }
  })
}

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
          {
            loader: path.join(__dirname, "..", "..", "dist"),
            options: {
              generate,
              compare,
            }
          },
          'babel-loader',
        ],
      },
    ],
  },
};
