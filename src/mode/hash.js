// eslint-disable-next-line no-unused-vars
const fsLib = require('fs');

const utils = require('../util');

function defaultCompare(stats, dep) {
  return stats.hash === dep.hash;
}

/**
 *
 * @param {*} options
 * @param {fsLib} fs
 * @param {*} context
 */
function createModeFns(options, fs, context) {
  const closureObj = {
    // Should the file get cached?
    cache: true,
  };
  const { readOnly, compare: compareFn = defaultCompare } = options;

  const { data } = context;

  const cache = {};

  return {
    toDepDetails(dep, mapCallback) {
      const cachedHash = cache[dep];

      function resolve(hash) {
        if (hash === data.hash) {
          closureObj.cache = false;
        }
        mapCallback(null, {
          path: utils.pathWithCacheContext(options.cacheContext, dep),
          hash,
        });
      }

      if (!cachedHash) {
        fs.readFile(dep, (err, bdata) => {
          if (err) {
            mapCallback(err);
            return;
          }
          resolve((cache[dep] = utils.digest(bdata)));
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
    closureObj,
  };
}

module.exports = createModeFns;
