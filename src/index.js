/* eslint-disable
  import/order
*/
const fs = require('fs');
const path = require('path');
const async = require('neo-async');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const pkgUp = require('pkg-up');

const { getOptions } = require('loader-utils');
const validateOptions = require('schema-utils');

const pkg = require('../package.json');

const env = process.env.NODE_ENV || 'development';

const schema = require('./options.json');

const defaults = {
  cacheDirectory: path.resolve('.cache-loader'),
  cacheIdentifier: `cache-loader:${pkg.version} ${env}`,
  projectRoot: path.dirname(pkgUp.sync()),
  cacheKey,
  read,
  write,
};

function loader(...args) {
  const options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, 'Cache Loader');

  const { write: writeFn, projectRoot } = options;

  const callback = this.async();
  const { data } = this;
  const dependencies = this.getDependencies().concat(this.loaders.map(l => l.path));
  const contextDependencies = this.getContextDependencies();

  // Should the file get cached?
  let cache = true;

  const toDepDetails = (dep, mapCallback) => {
    fs.stat(dep, (err, stats) => {
      if (err) {
        mapCallback(err);
        return;
      }

      const mtime = stats.mtime.getTime();

      if (mtime / 1000 >= Math.floor(data.startTime / 1000)) {
        // Don't trust mtime.
        // File was changed while compiling
        // or it could be an inaccurate filesystem.
        cache = false;
      }

      mapCallback(null, {
        path: dep,
        mtime,
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
    if (!cache) {
      callback(null, ...args);
      return;
    }
    const [deps, contextDeps] = taskResults;

    writeFn(data.cacheKey, {
      remainingRequest: removeProjectRoot(projectRoot, data.remainingRequest),
      dependencies: removeProjectRootFromDeps(projectRoot, deps),
      contextDependencies: removeProjectRootFromDeps(projectRoot, contextDeps),
      result: args,
    }, () => {
      // ignore errors here
      callback(null, ...args);
    });
  });
}

function reapplyProjectRoot(projectRoot, content) {
  return content.replace(/<projectRoot>/g, projectRoot);
}

function removeProjectRoot(projectRoot, content) {
  return content.replace(new RegExp(projectRoot, 'g'), '<projectRoot>');
}

function removeProjectRootFromDeps(projectRoot, deps) {
  return deps.map((dep) => {
    return {
      ...dep,
      path: removeProjectRoot(projectRoot, dep.path),
    };
  });
}

function pitch(remainingRequest, prevRequest, dataInput) {
  const options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, 'Cache Loader (Pitch)');

  const { read: readFn, cacheKey: cacheKeyFn, projectRoot } = options;

  const callback = this.async();
  const data = dataInput;

  data.remainingRequest = remainingRequest;
  data.cacheKey = cacheKeyFn(options, remainingRequest);
  readFn(data.cacheKey, (readErr, cacheData) => {
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
        data.startTime = Date.now();
        callback();
        return;
      }
      cacheData.dependencies.forEach(dep => this.addDependency(reapplyProjectRoot(projectRoot, dep.path)));
      cacheData.contextDependencies.forEach(dep => this.addContextDependency(reapplyProjectRoot(projectRoot, dep.path)));
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

function cacheKey(options, request) {
  const { cacheIdentifier, cacheDirectory, projectRoot } = options;
  const newRequest = removeProjectRoot(projectRoot, request);
  const hash = digest(`${cacheIdentifier}\n${newRequest}`);
  return path.join(cacheDirectory, `${hash}.json`);
}

export { loader as default, pitch };
