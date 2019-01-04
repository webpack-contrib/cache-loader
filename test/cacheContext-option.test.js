const path = require('path');

const normalizePath = require('normalize-path');

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
  deps.map((dep) => Object.assign({}, dep, { mtime: null, path: dep.path }));

const buildCacheLoaderCallsData = (calls) =>
  Array.from(
    calls
      .reduce((builtCalls, call) => {
        const [, rawData] = call;

        return builtCalls.set(rawData.remainingRequest, {
          ...rawData,
          remainingRequest: rawData.remainingRequest,
          dependencies: buildSnapshotReadyDeps(rawData.dependencies),
          contextDependencies: buildSnapshotReadyDeps(
            rawData.contextDependencies
          ),
        });
      }, new Map())
      .values()
  );

const sortData = (a, b) => {
  if (a.remainingRequest < b.remainingRequest) {
    return -1;
  }

  if (a.remainingRequest > b.remainingRequest) {
    return 1;
  }

  return 0;
};

describe('cacheContext option', () => {
  it('should generate relative paths to the project root', async () => {
    const testId = './basic/index.js';
    const stats = await webpack(testId, mockRelativeWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    ).sort(sortData);

    expect(
      cacheLoaderCallsData.every(
        (call) => !call.remainingRequest.includes(path.resolve('.'))
      )
    );
    expect(cacheLoaderCallsData).toMatchSnapshot('generated cache-loader data');
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });

  it('should generate normalized relative paths to the project root', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockRelativeWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    ).sort(sortData);

    expect(
      cacheLoaderCallsData.every(
        (call) => call.remainingRequest === normalizePath(call.remainingRequest)
      )
    );
  });

  it('should generate absolute paths to the project root', async () => {
    const testId = './basic/index.js';
    const stats = await webpack(testId, mockBaseWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    ).sort(sortData);

    expect(
      cacheLoaderCallsData.every((call) =>
        call.remainingRequest.includes(path.resolve('.'))
      )
    );
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });
});
