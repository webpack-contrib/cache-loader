/* eslint-disable
  import/order
*/
const fs = require('fs');
const os = require('os');
const v8 = require('v8');
const path = require('path');
const async = require('neo-async');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const findCacheDir = require('find-cache-dir');

const { getOptions } = require('loader-utils');
const validateOptions = require('schema-utils');

const pkg = require('../package.json');

const env = process.env.NODE_ENV || 'development';

const schema = require('./options.json');

const defaults = {
  cacheContext: '',
  cacheDirectory: findCacheDir({ name: 'cache-loader' }) || os.tmpdir(),
  cacheIdentifier: `cache-loader:${pkg.version} ${env}`,
  cacheKey,
  compare,
  precision: 0,
  read,
  readOnly: false,
  write,
};

function pathWithCacheContext(cacheContext, originalPath) {
  if (!cacheContext) {
    return originalPath;
  }

  if (originalPath.includes(cacheContext)) {
    return originalPath
      .split('!')
      .map((subPath) => path.relative(cacheContext, subPath))
      .join('!');
  }

  return originalPath
    .split('!')
    .map((subPath) => path.resolve(cacheContext, subPath))
    .join('!');
}

function roundMs(mtime, precision) {
  return Math.floor(mtime / precision) * precision;
}

// NOTE: We should only apply `pathWithCacheContext` transformations
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

      mapCallback(null, {
        path: pathWithCacheContext(options.cacheContext, dep),
        mtime,
      });
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
          remainingRequest: pathWithCacheContext(
            options.cacheContext,
            data.remainingRequest
          ),
          dependencies: deps,
          contextDependencies: contextDeps,
          addedFiles: data.addedFiles,
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

// NOTE: We should apply `pathWithCacheContext` transformations
// right after reading. Every other internal steps with the paths
// should be accomplish over absolute paths. Otherwise we have the risk
// to break watchpack -> chokidar watch logic  over webpack@4 --watch
function pitch(remainingRequest, prevRequest, dataInput) {
  const options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, {
    name: 'Cache Loader (Pitch)',
    baseDataPath: 'options',
  });

  const {
    cacheContext,
    cacheKey: cacheKeyFn,
    compare: compareFn,
    read: readFn,
    readOnly,
    precision,
  } = options;

  const callback = this.async();
  const data = dataInput;
  const { emitFile } = this;

  data.remainingRequest = remainingRequest;
  data.cacheKey = cacheKeyFn(options, data.remainingRequest);

  data.addedFiles = [];
  if (options.cacheAddedFiles) {
    this.emitFile = (name, content, sourceMap) => {
      data.addedFiles.push({ name, content, sourceMap });
      return emitFile(name, content, sourceMap);
    };
  }

  readFn(data.cacheKey, (readErr, cacheData) => {
    if (readErr) {
      callback();
      return;
    }

    // We need to patch every path within data on cache with the cacheContext,
    // or it would cause problems when watching
    if (
      pathWithCacheContext(options.cacheContext, cacheData.remainingRequest) !==
      data.remainingRequest
    ) {
      // in case of a hash conflict
      callback();
      return;
    }
    const FS = this.fs || fs;
    async.each(
      cacheData.dependencies.concat(cacheData.contextDependencies),
      (dep, eachCallback) => {
        // Applying reverse path transformation, in case they are relatives, when
        // reading from cache
        const contextDep = {
          ...dep,
          path: pathWithCacheContext(options.cacheContext, dep.path),
        };

        FS.stat(contextDep.path, (statErr, stats) => {
          if (statErr) {
            eachCallback(statErr);
            return;
          }

          // When we are under a readOnly config on cache-loader
          // we don't want to emit any other error than a
          // file stat error
          if (readOnly) {
            eachCallback();
            return;
          }

          const compStats = stats;
          const compDep = contextDep;
          if (precision > 1) {
            ['atime', 'mtime', 'ctime', 'birthtime'].forEach((key) => {
              const msKey = `${key}Ms`;
              const ms = roundMs(stats[msKey], precision);

              compStats[msKey] = ms;
              compStats[key] = new Date(ms);
            });

            compDep.mtime = roundMs(dep.mtime, precision);
          }

          // If the compare function returns false
          // we not read from cache
          if (compareFn(compStats, compDep) !== true) {
            eachCallback(true);
            return;
          }
          eachCallback();
        });
      },
      (err) => {
        if (err) {
          data.startTime = Date.now();
          callback();
          return;
        }
        cacheData.dependencies.forEach((dep) =>
          this.addDependency(pathWithCacheContext(cacheContext, dep.path))
        );
        cacheData.contextDependencies.forEach((dep) =>
          this.addContextDependency(
            pathWithCacheContext(cacheContext, dep.path)
          )
        );
        cacheData.addedFiles.forEach(({ name, content, sourceMap }) => {
          emitFile(name, content, sourceMap);
        });
        callback(null, ...cacheData.result);
      }
    );
  });
}

function digest(str) {
  return crypto
    .createHash('md5')
    .update(str)
    .digest('hex');
}

const directories = new Set();

function write(key, data, callback) {
  const dirname = path.dirname(key);
  const content = v8.serialize(data);

  if (directories.has(dirname)) {
    // for performance skip creating directory
    fs.writeFile(key, content, callback);
  } else {
    mkdirp(dirname, (mkdirErr) => {
      if (mkdirErr) {
        callback(mkdirErr);
        return;
      }

      directories.add(dirname);

      fs.writeFile(key, content, callback);
    });
  }
}

function read(key, callback) {
  fs.readFile(key, (err, content) => {
    if (err) {
      callback(err);
      return;
    }

    try {
      const data = v8.deserialize(content);
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

function cacheKey(options, request) {
  const { cacheIdentifier, cacheDirectory } = options;
  const hash = digest(`${cacheIdentifier}\n${request}`);

  return path.join(cacheDirectory, `${hash}.bin`);
}

function compare(stats, dep) {
  return stats.mtime.getTime() === dep.mtime;
}

export const raw = true;
export { loader as default, pitch };
