const fs = require('fs');
const path = require('path');

const del = require('del');

const { getRandomTmpDir, webpack } = require('./helpers');

const mockRandomTmpDir = getRandomTmpDir();

const mockCacheLoaderCompareFn = jest.fn();
const mockWebpackConfig = {
  loader: {
    options: {
      cacheDirectory: mockRandomTmpDir,
      compare: (stats, dep, cacheData) => {
        mockCacheLoaderCompareFn(stats, dep, cacheData);
        return true;
      },
    },
  },
};

const mockCacheLoaderCompareOnRelativeFn = jest.fn();
const mockRelativeWebpackConfig = {
  loader: {
    options: {
      cacheContext: path.resolve('./'),
      cacheDirectory: mockRandomTmpDir,
      compare: (stats, dep, cacheData) => {
        mockCacheLoaderCompareOnRelativeFn(stats, dep, cacheData);
        return true;
      },
    },
  },
};
describe('compare option', () => {
  beforeEach(() => {
    mockCacheLoaderCompareFn.mockClear();
    mockCacheLoaderCompareOnRelativeFn.mockClear();
  });

  afterAll(() => {
    del.sync(mockRandomTmpDir);
  });

  it('should call compare function', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();
  });

  it('should call compare function with 3 args', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();
    expect(mockCacheLoaderCompareFn.mock.calls[0].length).toBe(3);
  });

  it('should call compare function with correct args', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();

    // eslint-disable-next-line
    const stats = mockCacheLoaderCompareFn.mock.calls[0][0];
    // eslint-disable-next-line
    const dep = mockCacheLoaderCompareFn.mock.calls[0][1];
    // eslint-disable-next-line
    const cacheData = mockCacheLoaderCompareFn.mock.calls[0][2];
    expect(stats).toBeDefined();
    expect(stats instanceof fs.Stats);
    expect(dep).toBeDefined();
    expect(dep.mtime).toBeDefined();
    expect(dep.path).toBeDefined();
    expect(cacheData).toBeDefined();
    expect(cacheData.remainingRequest).toBeDefined();
    expect(cacheData.source).toBeDefined();
    expect(cacheData.dependencies).toBeDefined();
    expect(cacheData.contextDependencies).toBeDefined();
    expect(cacheData.result).toBeDefined();
  });

  it('should call compare with contextualized dep', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockRelativeWebpackConfig);
    mockCacheLoaderCompareFn.mockClear();

    const stats = await webpack(testId, mockRelativeWebpackConfig);

    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
    expect(mockCacheLoaderCompareOnRelativeFn).toHaveBeenCalled();

    // eslint-disable-next-line
    const dep = mockCacheLoaderCompareOnRelativeFn.mock.calls[0][1];
    expect(path.isAbsolute(dep.path)).toBeTruthy();
  });
});
