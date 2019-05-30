const { webpack } = require('./helpers');

const mockCacheLoaderCompareFn = jest.fn();
const mockWebpackConfig = {
  loader: {
    options: {
      compare: () => {
        mockCacheLoaderCompareFn();
        return true;
      },
    },
  },
};

describe('compare option', () => {
  it('should call compare function', async () => {
    const testId = './basic/index.js';
    await webpack(testId, mockWebpackConfig);
    expect(mockCacheLoaderCompareFn).toHaveBeenCalled();
  });
});
