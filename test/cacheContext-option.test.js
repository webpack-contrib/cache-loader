const path = require('path');
const { webpack } = require('./helpers');

const mockCacheLoaderWriteFn = jest.fn();
const mockBaseWebpackConfig = {
  loader: {
    options: {
      write: (cacheKey, cacheData, callback) => {
        mockCacheLoaderWriteFn(cacheKey, cacheData, callback);
        callback(null, ...cacheData.result);
      },
    },
  },
};
const mockRelativeWebpackConfig = {
  loader: {
    options: {
      cacheContext: path.resolve('.'),
      write: (cacheKey, cacheData, callback) => {
        mockCacheLoaderWriteFn(cacheKey, cacheData, callback);
        callback(null, ...cacheData.result);
      },
    },
  },
};

const buildSnapshotReadyDeps = (deps) =>
  deps
    .map((dep) => Object.assign({}, dep, { mtime: null }))
    .sort((a, b) => (a.path > b.path ? 1 : b.path > a.path ? -1 : 0));

const buildCacheLoaderCallsData = (calls) =>
  calls.map((rawCall) => {
    const call = rawCall[1];
    return {
      ...call,
      dependencies: buildSnapshotReadyDeps(call.dependencies),
      contextDependencies: buildSnapshotReadyDeps(call.contextDependencies),
    };
  });

describe('cacheContext option', () => {
  it('should generate relative paths to the project root', async () => {
    const testId = './basic/index.js';
    const stats = await webpack(testId, mockRelativeWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    );

    expect(
      cacheLoaderCallsData.every(
        (call) => !call.remainingRequest.includes(path.resolve('.'))
      )
    );
    expect(cacheLoaderCallsData).toMatchSnapshot('generated cache-loader data');
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });

  it('should generate absolute paths to the project root', async () => {
    const testId = './basic/index.js';
    const stats = await webpack(testId, mockBaseWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    );

    expect(
      cacheLoaderCallsData.every((call) =>
        call.remainingRequest.includes(path.resolve('.'))
      )
    );
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });
});
