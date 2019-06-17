const path = require('path');

const normalizePath = require('normalize-path');
const BJSON = require('buffer-json');

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

const sortData = (a, b) => {
  if (a.remainingRequest < b.remainingRequest) {
    return -1;
  }

  if (a.remainingRequest > b.remainingRequest) {
    return 1;
  }

  return 0;
};

const buildSnapshotReadyDeps = (deps, normalizePaths = true) =>
  deps.map((dep) =>
    Object.assign({}, dep, {
      mtime: null,
      path: normalizePaths ? normalizePath(dep.path) : dep.path,
    })
  );

const buildCacheLoaderCallsData = (calls, normalizePaths = true) =>
  Array.from(
    calls
      .reduce((builtCalls, call) => {
        const [, rawData] = call;

        return builtCalls.set(rawData.remainingRequest, {
          ...rawData,
          remainingRequest: normalizePaths
            ? normalizePath(rawData.remainingRequest)
            : rawData.remainingRequest,
          dependencies: buildSnapshotReadyDeps(
            rawData.dependencies,
            normalizePaths
          ),
          contextDependencies: buildSnapshotReadyDeps(
            rawData.contextDependencies,
            normalizePaths
          ),
        });
      }, new Map())
      .values()
  ).sort(sortData);

describe('cacheContext option', () => {
  beforeEach(() => {
    mockCacheLoaderWriteFn.mockClear();
  });

  it('should generate relative paths to the project root', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockBaseWebpackConfig);
    mockCacheLoaderWriteFn.mockClear();
    const stats = await webpack(testId, mockRelativeWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    );

    expect(
      cacheLoaderCallsData.every(
        (call) =>
          !call.remainingRequest.includes(normalizePath(path.resolve('.')))
      )
    ).toBeTruthy();
    expect(BJSON.stringify(cacheLoaderCallsData, 2)).toMatchSnapshot(
      'generated cache-loader data'
    );
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });

  it('should generate non normalized relative paths to the project root on windows', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockBaseWebpackConfig);
    await webpack(testId, mockRelativeWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls,
      false
    );

    // NOTE: this test prevents to generate normalized paths for the generated cache assets
    // under windows which will break the watcher due to a bug on watchpack/chokidar
    if (process.platform === 'win32') {
      expect(
        cacheLoaderCallsData.every(
          (call) =>
            call.remainingRequest !== normalizePath(call.remainingRequest)
        )
      ).toBeTruthy();
    } else {
      expect(
        cacheLoaderCallsData.every(
          (call) =>
            call.remainingRequest === normalizePath(call.remainingRequest)
        )
      ).toBeTruthy();
    }
  });

  it('should generate absolute paths to the project root', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockRelativeWebpackConfig);
    mockCacheLoaderWriteFn.mockClear();
    const stats = await webpack(testId, mockBaseWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    );

    expect(
      cacheLoaderCallsData.every((call) =>
        call.remainingRequest.includes(normalizePath(path.resolve('.')))
      )
    ).toBeTruthy();
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });

  it('should load as a raw loader to support images', async () => {
    const testId = './img/index.js';
    await webpack(testId, mockRelativeWebpackConfig);
    const stats = await webpack(testId, mockBaseWebpackConfig);

    const cacheLoaderCallsData = buildCacheLoaderCallsData(
      mockCacheLoaderWriteFn.mock.calls
    );

    expect(
      cacheLoaderCallsData.every((call) => Buffer.isBuffer(call.result[0]))
    );
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
  });
});
