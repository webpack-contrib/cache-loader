const del = require('del');

const { getRandomTmpDir, webpack } = require('./helpers');

const mockRandomTmpDir = getRandomTmpDir();

const mockCacheLoaderCompareFn = jest.fn();
const mockCacheLoaderCompareWithPrecisionFn = jest.fn();
const mockWebpackConfig = {
  loader: {
    options: {
      cacheDirectory: mockRandomTmpDir,
      compare: (stats, dep) => {
        mockCacheLoaderCompareFn(stats, dep);
        return true;
      },
    },
  },
};
const mockWebpackWithPrecisionConfig = {
  loader: {
    options: {
      cacheDirectory: mockRandomTmpDir,
      compare: (stats, dep) => {
        mockCacheLoaderCompareWithPrecisionFn(stats, dep);
        return true;
      },
      precision: 1000,
    },
  },
};

describe('precision option', () => {
  beforeEach(() => {
    mockCacheLoaderCompareFn.mockClear();
    mockCacheLoaderCompareWithPrecisionFn.mockClear();
  });

  afterAll(() => {
    del.sync(mockRandomTmpDir, { force: true });
  });

  it('should not apply precision', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    mockCacheLoaderCompareFn.mockClear();

    await webpack(testId, mockWebpackConfig);

    const pastPrecisionTime = mockCacheLoaderCompareFn.mock.calls[0][1].mtime;
    mockCacheLoaderCompareFn.mockClear();

    await webpack(testId, mockWebpackConfig);
    expect(pastPrecisionTime).toBe(
      mockCacheLoaderCompareFn.mock.calls[0][1].mtime
    );
  });

  it('should call compare with values after applying precision', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    mockCacheLoaderCompareFn.mockClear();
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackWithPrecisionConfig);
    expect(mockCacheLoaderCompareFn.mock.calls[0][1].mtime).not.toBe(
      mockCacheLoaderCompareWithPrecisionFn.mock.calls[0][1].mtime
    );
  });

  it('should apply precision dividing by the value', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    mockCacheLoaderCompareFn.mockClear();
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackWithPrecisionConfig);

    const newMtime =
      mockCacheLoaderCompareWithPrecisionFn.mock.calls[0][1].mtime;
    const oldMtime = mockCacheLoaderCompareFn.mock.calls[0][1].mtime;
    expect(newMtime).toBe(Math.floor(oldMtime / 1000) * 1000);
  });
});
