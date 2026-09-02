import {
  deriveContentVerses,
  verseLabelsFromMarkVersesRegions,
} from './transcribeContentVerses';

describe('deriveContentVerses', () => {
  it('marks verses with content after the marker', () => {
    expect(
      deriveContentVerses('\\v 10 In the beginning \\v 11 ', ['10', '11'])
    ).toEqual(['10']);
  });

  it('uses no-verses when there are no markers', () => {
    expect(deriveContentVerses('plain text', [])).toEqual(['no-verses']);
  });

  it('handles range labels', () => {
    expect(
      deriveContentVerses('\\v 3-4 Combined text', ['3-4'])
    ).toEqual(['3-4']);
  });

  it('returns empty when transcription is empty', () => {
    expect(deriveContentVerses('', ['10'])).toEqual([]);
  });
});

describe('verseLabelsFromMarkVersesRegions', () => {
  it('extracts verse numbers from region labels', () => {
    expect(verseLabelsFromMarkVersesRegions(['1:10', '1:11-12'])).toEqual([
      '10',
      '11-12',
    ]);
  });
});
