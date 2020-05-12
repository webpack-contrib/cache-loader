import loader, { pitch } from '../src';

// Needed for `schema-utils` to not call
// process.exit(1) when running tests
process.env.JEST = true;

describe('validate options', () => {
  test('error', () => {
    const err = () => loader.call({ query: { cacheIdentifier: 1 } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });

  test('unknown', () => {
    const err = () => loader.call({ query: { unknown: 'unknown' } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });

  test('error (pitch)', () => {
    const err = () => pitch.call({ query: { cacheIdentifier: 1 } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });

  test('unknown (pitch)', () => {
    const err = () => pitch.call({ query: { unknown: 'unknown' } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });
});
