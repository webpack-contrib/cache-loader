// eslint-disable-next-line no-unused-vars
const fsLib = require('fs');

const utils = require('../util');

/**
 *
 * @param {*} options
 * @param {fsLib} fs
 * @param {*} context
 */
module.exports = function createModeFns(options, fs, context) {
  const closureObj = {
    // Should the file get cached?
    cache: true,
  };
  const { readOnly, precision, compare: compareFn } = options;
  const { data } = context;
  return {
    toDepDetails(dep, mapCallback) {
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
          closureObj.cache = false;
        }

        mapCallback(null, {
          path: utils.pathWithCacheContext(options.cacheContext, dep),
          mtime,
        });
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
          eachCallback(true, Date.now());
          return;
        }
        eachCallback();
      });
    },
    closureObj,
  };
};
