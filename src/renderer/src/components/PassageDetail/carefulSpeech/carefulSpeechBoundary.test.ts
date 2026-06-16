import { hasClauseRegions } from './carefulSpeechBoundary';

describe('carefulSpeechBoundary', () => {
  it('hasClauseRegions is true when regions array is non-empty', () => {
    expect(
      hasClauseRegions(JSON.stringify({ regions: [{ start: 0, end: 1 }] }))
    ).toBe(true);
  });

  it('hasClauseRegions is false for empty or invalid json', () => {
    expect(hasClauseRegions('{}')).toBe(false);
    expect(hasClauseRegions('not json')).toBe(false);
  });
});
