// eslint-disable-next-line no-unused-vars
const fs = require('fs');

const utils = require('../util');

const isDev = process.env.NODE_ENV === 'development';

// NOTE: only use for building
const localCache = {};

function defaultCompare(stats, dep) {
  return stats.hash === dep.hash;
}

function createModeFns(options) {
  const { readOnly, compare: compareFn = defaultCompare } = options;

  return {
    generateDepDetails(dep, mtime, mapCallback) {
      const cachedHash = localCache[dep];

      function resolve(hash) {
        mapCallback(null, {
          path: utils.pathWithCacheContext(options.cacheContext, dep),
          hash,
        });
      }

      if (isDev || !cachedHash) {
        fs.readFile(dep, (err, bdata) => {
          if (err) {
            mapCallback(err);
            return;
          }
          resolve((localCache[dep] = utils.digest(bdata)));
        });
      } else {
        resolve(cachedHash);
      }
    },
    validDepDetails(dep, eachCallback) {
      // Applying reverse path transformation, in case they are relatives, when
      // reading from cache
      const contextDep = {
        ...dep,
        path: utils.pathWithCacheContext(options.cacheContext, dep.path),
      };

      const cachedHash = localCache[contextDep.path];

      function resolve(hash) {
        const compStats = {
          hash,
          path: contextDep.path,
        };
        const compDep = contextDep;

        // If the compare function returns false
        // we not read from cache
        if (compareFn(compStats, compDep) !== true) {
          eachCallback(true);
          return;
        }
        eachCallback();
      }

      if (isDev || !cachedHash) {
        fs.readFile(contextDep.path, (err, bdata) => {
          if (err) {
            eachCallback(err);
            return;
          }

          // When we are under a readOnly config on cache-loader
          // we don't want to emit any other error than a
          // file stat error
          if (readOnly) {
            eachCallback();
            return;
          }

          const currentHash = utils.digest(bdata);
          localCache[contextDep.path] = currentHash;

          resolve(currentHash);
        });
      } else {
        resolve(cachedHash);
      }
    },
  };
}

module.exports = createModeFns;
