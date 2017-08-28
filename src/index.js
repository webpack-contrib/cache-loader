const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const loaderUtils = require('loader-utils');
const pkgVersion = require('../package.json').version;

const defaultCacheDirectory = path.resolve('.cache-loader');
const ENV = process.env.NODE_ENV || 'development';

function loader(...args) {
  const callback = this.async();
  const { data } = this;
  const dependencies = this.getDependencies().concat(this.loaders.map(l => l.path));
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
    const writeCacheFile = () => {
      fs.writeFile(data.cacheFile, JSON.stringify({
        remainingRequest: data.remainingRequest,
        cacheIdentifier: data.cacheIdentifier,
        dependencies: deps,
        contextDependencies: contextDeps,
        result: args,
      }), 'utf-8', () => {
        // ignore errors here
        callback(null, ...args);
      });
    };
    if (data.fileExists) {
      // for performance skip creating directory
      writeCacheFile();
    } else {
      mkdirp(path.dirname(data.cacheFile), (mkdirErr) => {
        if (mkdirErr) {
          callback(null, ...args);
          return;
        }
        writeCacheFile();
      });
    }
  });
}

function pitch(remainingRequest, prevRequest, dataInput) {
  const loaderOptions = loaderUtils.getOptions(this) || {};
  const defaultOptions = {
    cacheDirectory: defaultCacheDirectory,
    cacheIdentifier: `cache-loader:${pkgVersion} ${ENV}`,
  };
  const options = Object.assign({}, defaultOptions, loaderOptions);
  const { cacheIdentifier, cacheDirectory } = options;
  const data = dataInput;
  const callback = this.async();
  const hash = digest(`${cacheIdentifier}\n${remainingRequest}`);
  const cacheFile = path.join(cacheDirectory, `${hash}.json`);
  data.remainingRequest = remainingRequest;
  data.cacheIdentifier = cacheIdentifier;
  data.cacheFile = cacheFile;
  fs.readFile(cacheFile, 'utf-8', (readFileErr, content) => {
    if (readFileErr) {
      callback();
      return;
    }
    data.fileExists = true;
    let cacheData;
    try {
      cacheData = JSON.parse(content);
    } catch (e) {
      callback();
      return;
    }
    if (cacheData.remainingRequest !== remainingRequest || cacheData.cacheIdentifier !== cacheIdentifier) {
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

export { loader as default, pitch };
