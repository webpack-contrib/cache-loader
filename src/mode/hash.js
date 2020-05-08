// eslint-disable-next-line no-unused-vars
const fs = require('fs');

const utils = require('../util');

function defaultCompare(stats, dep) {
  return stats.hash === dep.hash;
}

function createModeFns(options) {
  const { readOnly, compare: compareFn = defaultCompare } = options;

  const cache = {};

  return {
    validDepDetails(dep, eachCallback) {
      // Applying reverse path transformation, in case they are relatives, when
      // reading from cache
      const contextDep = {
        ...dep,
        path: utils.pathWithCacheContext(options.cacheContext, dep.path),
      };

      const cachedHash = cache(contextDep.path);

      function resolve(hash) {
        const compStats = {
          hash,
          path: contextDep.path,
        };
        const compDep = contextDep;

        // If the compare function returns false
        // we not read from cache
        if (compareFn(compStats, compDep) !== true) {
          eachCallback(true, hash);
          return;
        }
        eachCallback();
      }

      if (!cachedHash) {
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

          resolve(currentHash);
        });
      } else {
        resolve(cachedHash);
      }
    },
  };
}

module.exports = createModeFns;
