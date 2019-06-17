const fs = require('fs');
const path = require('path');

const { webpack } = require('./helpers');

const mockCacheLoaderCompareFn = jest.fn();
const mockCacheLoaderCompareOnRelativeFn = jest.fn();
const mockWebpackConfig = {
  loader: {
    options: {
      compare: (stats, dep) => {
        mockCacheLoaderCompareFn(stats, dep);
        return true;
      },
    },
  },
};

const mockRelativeWebpackConfig = {
  loader: {
    options: {
      cacheContext: path.resolve('../'),
      compare: (stats, dep) => {
        mockCacheLoaderCompareOnRelativeFn(stats, dep);
        return true;
      },
    },
  },
};
describe('compare option', () => {
  beforeEach(() => {
    mockCacheLoaderCompareFn.mockClear();
  });

  it('should call compare function', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();
  });

  it('should call compare function with 2 args', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();
    expect(mockCacheLoaderCompareFn.mock.calls[0].length).toBe(2);
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
    expect(stats).toBeDefined();
    expect(stats instanceof fs.Stats);
    expect(dep).toBeDefined();
    expect(dep.mtime).toBeDefined();
    expect(dep.path).toBeDefined();
  });

  it('should call compare with contextualized dep', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockRelativeWebpackConfig);
    await webpack(testId, mockRelativeWebpackConfig);
    expect(mockCacheLoaderCompareOnRelativeFn).toHaveBeenCalled();

    // eslint-disable-next-line
    const dep = mockCacheLoaderCompareOnRelativeFn.mock.calls[0][1];
    expect(path.isAbsolute(dep.path)).toBeTruthy();
  });
});
