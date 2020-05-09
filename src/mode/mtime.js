const fs = require('fs');

const utils = require('../util');

function defaultCompare(stats, dep) {
  return stats.mtime.getTime() === dep.mtime;
}

module.exports = function createModeFns(options) {
  const { readOnly, precision, compare: compareFn = defaultCompare } = options;
  return {
    generateDepDetails(dep, mtime, mapCallback) {
      mapCallback(null, {
        path: utils.pathWithCacheContext(options.cacheContext, dep),
        mtime,
      });
    },
    validDepDetails(dep, eachCallback) {
      // Applying reverse path transformation, in case they are relatives, when
      // reading from cache
      const contextDep = {
        ...dep,
        path: utils.pathWithCacheContext(options.cacheContext, dep.path),
      };

      fs.stat(contextDep.path, (statErr, stats) => {
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
            const ms = utils.roundMs(stats[msKey], precision);

            compStats[msKey] = ms;
            compStats[key] = new Date(ms);
          });

          compDep.mtime = utils.roundMs(dep.mtime, precision);
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
  };
};
