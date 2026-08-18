import { isPlayableMediaSrc, shouldIgnorePeaksReady } from './wavesurferReady';

describe('isPlayableMediaSrc', () => {
  it('accepts blob and http src', () => {
    expect(isPlayableMediaSrc('blob:https://app.example/1', '')).toBe(true);
    expect(isPlayableMediaSrc('', 'blob:https://app.example/1')).toBe(true);
    expect(isPlayableMediaSrc('https://cdn.example/a.wav', '')).toBe(true);
  });

  it('rejects empty or page-relative src', () => {
    expect(isPlayableMediaSrc('', '')).toBe(false);
    expect(isPlayableMediaSrc(undefined, null)).toBe(false);
    expect(isPlayableMediaSrc('', '/record')).toBe(false);
  });
});

describe('shouldIgnorePeaksReady', () => {
  const gens = { peaksGeneration: 0, loadGeneration: 1, blobGeneration: 1 };

  it('does not ignore a blob load whose currentSrc is not set yet', () => {
    expect(
      shouldIgnorePeaksReady({
        ...gens,
        currentSrc: '',
        srcAttr: 'blob:https://app.example/uuid',
      })
    ).toBe(false);
  });

  it('ignores a peaks-only preview with no src', () => {
    expect(
      shouldIgnorePeaksReady({
        ...gens,
        currentSrc: '',
        srcAttr: '',
      })
    ).toBe(true);
  });

  it('does not ignore a load that already has currentSrc', () => {
    expect(
      shouldIgnorePeaksReady({
        ...gens,
        currentSrc: 'blob:https://app.example/uuid',
        srcAttr: 'blob:https://app.example/uuid',
      })
    ).toBe(false);
  });
});
