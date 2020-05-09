/* eslint-disable
  import/order
*/
const fs = require('fs');
const os = require('os');
const path = require('path');
const async = require('neo-async');
const mkdirp = require('mkdirp');
const findCacheDir = require('find-cache-dir');
const BJSON = require('buffer-json');

const { getOptions } = require('loader-utils');
const validateOptions = require('schema-utils');

const pkg = require('../package.json');

const env = process.env.NODE_ENV || 'development';

const schema = require('./options.json');

const utils = require('./util');

const defaults = {
  cacheContext: '',
  cacheDirectory: findCacheDir({ name: 'cache-loader' }) || os.tmpdir(),
  cacheIdentifier: `cache-loader:${pkg.version} ${env}`,
  cacheKey,
  precision: 0,
  read,
  readOnly: false,
  write,
  mode: 'mtime',
};

function getModeFns(options, context) {
  const createModeFns =
    // eslint-disable-next-line
    options.mode === 'hash' ? require('./mode/hash') : require('./mode/mtime');
  return createModeFns(options, context);
}

// NOTE: We should only apply `utils.pathWithCacheContext` transformations
// right before writing. Every other internal steps with the paths
// should be accomplish over absolute paths. Otherwise we have the risk
// to break watchpack -> chokidar watch logic  over webpack@4 --watch
function loader(...args) {
  const options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, {
    name: 'Cache Loader',
    baseDataPath: 'options',
  });

  const { readOnly, write: writeFn } = options;

  // In case we are under a readOnly mode on cache-loader
  // we don't want to write or update any cache file
  if (readOnly) {
    this.callback(null, ...args);
    return;
  }

  const callback = this.async();
  const { data } = this;
  const dependencies = this.getDependencies().concat(
    this.loaders.map((l) => l.path)
  );
  const contextDependencies = this.getContextDependencies();

  // Should the file get cached?
  let cache = true;
  // this.fs can be undefined
  // e.g when using the thread-loader
  // fallback to the fs module
  const FS = this.fs || fs;
  const { generateDepDetails } = getModeFns(options);

  const toDepDetails = (dep, mapCallback) => {
    FS.stat(dep, (err, stats) => {
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

      generateDepDetails(dep, mtime, mapCallback);
    });
  };
  async.parallel(
    [
      (cb) => async.mapLimit(dependencies, 20, toDepDetails, cb),
      (cb) => async.mapLimit(contextDependencies, 20, toDepDetails, cb),
    ],
    (err, taskResults) => {
      if (err) {
        callback(null, ...args);
        return;
      }
      if (!cache) {
        callback(null, ...args);
        return;
      }
      const [deps, contextDeps] = taskResults;
      writeFn(
        data.cacheKey,
        {
          remainingRequest: utils.pathWithCacheContext(
            options.cacheContext,
            data.remainingRequest
          ),
          dependencies: deps,
          contextDependencies: contextDeps,
          result: args,
        },
        () => {
          // ignore errors here
          callback(null, ...args);
        }
      );
    }
  );
}

// NOTE: We should apply `utils.pathWithCacheContext` transformations
// right after reading. Every other internal steps with the paths
// should be accomplish over absolute paths. Otherwise we have the risk
// to break watchpack -> chokidar watch logic  over webpack@4 --watch
function pitch(remainingRequest, prevRequest, dataInput) {
  const options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, {
    name: 'Cache Loader (Pitch)',
    baseDataPath: 'options',
  });

  const { cacheContext, cacheKey: cacheKeyFn, read: readFn } = options;

  const callback = this.async();
  const data = dataInput;

  data.remainingRequest = remainingRequest;
  data.cacheKey = cacheKeyFn(options, data.remainingRequest);
  readFn(data.cacheKey, (readErr, cacheData) => {
    if (readErr) {
      callback();
      return;
    }

    // We need to patch every path within data on cache with the cacheContext,
    // or it would cause problems when watching
    if (
      utils.pathWithCacheContext(
        options.cacheContext,
        cacheData.remainingRequest
      ) !== data.remainingRequest
    ) {
      // in case of a hash conflict
      callback();
      return;
    }
    const { validDepDetails } = getModeFns(options);
    async.each(
      cacheData.dependencies.concat(cacheData.contextDependencies),
      validDepDetails,
      (err) => {
        if (err) {
          data.startTime = Date.now();
          callback();
          return;
        }
        cacheData.dependencies.forEach((dep) =>
          this.addDependency(utils.pathWithCacheContext(cacheContext, dep.path))
        );
        cacheData.contextDependencies.forEach((dep) =>
          this.addContextDependency(
            utils.pathWithCacheContext(cacheContext, dep.path)
          )
        );
        callback(null, ...cacheData.result);
      }
    );
  });
}

const directories = new Set();

function write(key, data, callback) {
  const dirname = path.dirname(key);
  const content = BJSON.stringify(data);

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
      const data = BJSON.parse(content);
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

function cacheKey(options, request) {
  const { cacheIdentifier, cacheDirectory } = options;
  const hash = utils.digest(`${cacheIdentifier}\n${request}`);

  return path.join(cacheDirectory, `${hash}.json`);
}

export const raw = true;
export { loader as default, pitch };
