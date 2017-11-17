import loader, { pitch } from '../src';

// Needed for `schema-utils` to not call
// process.exit(1) when running tests
process.env.JEST = true;

describe('Errors', () => {
  test('Validation Error', () => {
    const err = () => loader.call({ query: { cacheIdentifier: 1 } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });

  test('Validation Error (Pitch)', () => {
    const err = () => pitch.call({ query: { cacheIdentifier: 1 } });

    expect(err).toThrow();
    expect(err).toThrowErrorMatchingSnapshot();
  });
});
