const fs = require('fs');

const { webpack } = require('./helpers');

const mockCacheLoaderCompareFn = jest.fn();
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

describe('compare option', () => {
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

    const stats = mockCacheLoaderCompareFn.mock.calls[0][0];
    const dep = mockCacheLoaderCompareFn.mock.calls[0][1];
    expect(stats).toBeDefined();
    expect(stats instanceof fs.Stats);
    expect(dep).toBeDefined();
    expect(dep.mtime).toBeDefined();
    expect(dep.path).toBeDefined();
  });
});
