const path = require('path');
const crypto = require('crypto');

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

function digest(str) {
  return crypto
    .createHash('md5')
    .update(str)
    .digest('hex');
}

module.exports = {
  pathWithCacheContext,
  roundMs,
  digest,
};
