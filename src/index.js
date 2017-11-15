const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const loaderUtils = require('loader-utils');
const pkgVersion = require('../package.json').version;

const ENV = process.env.NODE_ENV || 'development';

const defaults = {
  directory: path.resolve('.cache-loader'),
  identifier: `cache-loader:${pkgVersion} ${ENV}`,
  key,
  read,
  write,
};

function loader(...args) {
  const { data } = this;

  const options = Object.assign({}, defaults, loaderUtils.getOptions(this));
  const { write: writeFn } = options;

  const callback = this.async();

  const dependencies = this.getDependencies()
    .concat(this.loaders.map(loader => loader.path));
  const contextDependencies = this.getContextDependencies();

  const toDepDetails = (dep, mapCallback) => {
    fs.stat(dep, (err, stats) => {
      if (err) {
        mapCallback(err);
        return;
      }
      mapCallback(null, {
        path: dep,
        mtime: stats.mtime.getTime(),
      });
    });
  };

  async.parallel([
    cb => async.mapLimit(dependencies, 20, toDepDetails, cb),
    cb => async.mapLimit(contextDependencies, 20, toDepDetails, cb),
  ], (err, taskResults) => {
    if (err) {
      callback(null, ...args);
      return;
    }
    const [deps, contextDeps] = taskResults;

    writeFn(data.key, {
      remainingRequest: data.remainingRequest,
      dependencies: deps,
      contextDependencies: contextDeps,
      result: args,
    }, () => {
      // ignore errors here
      callback(null, ...args);
    });
  });
}

function pitch(remainingRequest, prevRequest, dataInput) {
  const options = Object.assign({}, defaults, loaderUtils.getOptions(this));
  const callback = this.async();
  const { read: readFn, key: keyFn } = options;
  const data = dataInput;

  data.remainingRequest = remainingRequest;
  data.key = keyFn(options, remainingRequest);

  readFn(data.key, (readErr, cacheData) => {
    if (readErr) {
      callback();
      return;
    }
    if (cacheData.remainingRequest !== remainingRequest) {
      // in case of a hash conflict
      callback();
      return;
    }
    async.each(cacheData.dependencies.concat(cacheData.contextDependencies), (dep, eachCallback) => {
      fs.stat(dep.path, (statErr, stats) => {
        if (statErr) {
          eachCallback(statErr);

          return;
        }
        if (stats.mtime.getTime() !== dep.mtime) {
          eachCallback(true);

          return;
        }
        eachCallback();
      });
    }, (err) => {
      if (err) {
        callback();

        return;
      }

      cacheData.dependencies.forEach(dep => this.addDependency(dep.path));
      cacheData.contextDependencies.forEach(dep => this.addContextDependency(dep.path));

      callback(null, ...cacheData.result);
    });
  });
}

function digest(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

const directories = new Set();

function write(key, data, callback) {
  const dirname = path.dirname(key);
  const content = JSON.stringify(data);

  if (directories.has(dirname)) {
    // for performance skip creating directory
    fs.writeFile(key, content, 'utf-8', callback);
  } else {
    mkdirp(dirname, (mkdirErr) => {
      if (mkdirErr) {
        callback(mkdirErr);
        return;
      }

      directories.add(dirname);

      fs.writeFile(key, content, 'utf-8', callback);
    });
  }
}

function read(key, callback) {
  fs.readFile(key, 'utf-8', (err, content) => {
    if (err) {
      callback(err);
      return;
    }

    try {
      const data = JSON.parse(content);
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

function key(options, request) {
  const { identifier, directory } = options;
  const hash = digest(`${identifier}\n${request}`);

  return path.join(directory, `${hash}.json`);
}

export { loader as default, pitch };
