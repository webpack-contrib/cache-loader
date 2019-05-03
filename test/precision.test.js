const { webpack } = require('./helpers');

const testId = './basic/index.js';

const isRounded = (ms, precision) =>
  typeof ms === 'number' &&
  ms === (Math.floor(ms / precision || 1) * precision || 1);

const compareFn = jest.fn().mockName('compareFn');

function makeConfig(precision) {
  compareFn
    .mockReset()
    .mockImplementation(
      (stats, dep) =>
        isRounded(stats.mtime.getTime(), precision) &&
        isRounded(dep.mtime, precision)
    );

  return {
    loader: {
      options: {
        ...(precision && { precision }),
        compare: (...args) => compareFn(...args),
      },
    },
  };
}

describe('precision option', () => {
  it('should not round by default', async () => {
    await webpack(testId, makeConfig());
  });

  it('should round mtime', async () => {
    await webpack(testId, makeConfig(1000));
    expect(compareFn).toHaveReturnedWith(true);

    await webpack(testId, makeConfig(345));
    expect(compareFn).toHaveReturnedWith(true);
  });
});
