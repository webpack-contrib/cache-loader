const del = require('del');

const { getRandomTmpDir, webpack } = require('./helpers');

const mockRandomTmpDir = getRandomTmpDir();
const mockRandomTmpDirForAddedFiles = getRandomTmpDir();

const mockWebpackConfig = {
  loader: {
    options: {
      cacheDirectory: mockRandomTmpDir,
    },
  },
};
const mockWebpackWithAddedFilesConfig = {
  loader: {
    options: {
      cacheDirectory: mockRandomTmpDirForAddedFiles,
      cacheAddedFiles: true,
    },
  },
};

const cachedImageFilename = '92be28d7dfd7b29034ae9500cc94e7f2.png';

describe('cacheAddedFiles option', () => {
  beforeEach(() => {});

  afterAll(() => {
    del.sync(mockRandomTmpDir, { force: true });
    del.sync(mockRandomTmpDirForAddedFiles, { force: true });
  });

  it('should not cache added files', async () => {
    const testId = './img/index.js';
    const stats = await webpack(testId, mockWebpackConfig);
    const cachedStats = await webpack(testId, mockWebpackConfig);

    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
    expect(cachedStats.compilation.warnings).toMatchSnapshot('warnings');
    expect(cachedStats.compilation.errors).toMatchSnapshot('errors');

    expect(stats.compilation.assets[cachedImageFilename]).toBeDefined();
    expect(
      cachedStats.compilation.assets[cachedImageFilename]
    ).not.toBeDefined();
  });

  it('should cache added files', async () => {
    const testId = './img/index.js';
    const stats = await webpack(testId, mockWebpackWithAddedFilesConfig);
    const cachedStats = await webpack(testId, mockWebpackWithAddedFilesConfig);

    expect(stats.compilation.warnings).toMatchSnapshot('warnings');
    expect(stats.compilation.errors).toMatchSnapshot('errors');
    expect(cachedStats.compilation.warnings).toMatchSnapshot('warnings');
    expect(cachedStats.compilation.errors).toMatchSnapshot('errors');

    expect(stats.compilation.assets[cachedImageFilename]).toEqual(
      cachedStats.compilation.assets[cachedImageFilename]
    );
  });
});
