import { shouldIgnorePeaksReady } from './wavesurferReady';

describe('shouldIgnorePeaksReady', () => {
  it('accepts the loadBlob token for this generation', () => {
    expect(shouldIgnorePeaksReady(1, 1)).toBe(false);
  });

  it('ignores peaks-only ready with no token', () => {
    expect(shouldIgnorePeaksReady(undefined, 1)).toBe(true);
  });

  it('ignores a token from a previous generation', () => {
    expect(shouldIgnorePeaksReady(0, 1)).toBe(true);
  });
});
