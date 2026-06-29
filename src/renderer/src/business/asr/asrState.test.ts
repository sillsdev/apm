import { AsrTarget } from './AsrTarget';
import { IAsrState, asrStatesEqual, normalizeAsrState } from './asrState';

const baseState = (): IAsrState => ({
  target: AsrTarget.alphabet,
  language: {
    bcp47: 'en',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'eng',
  method: 'whisper',
  dialect: undefined,
  selectRoman: false,
});

describe('asrStatesEqual', () => {
  it('treats copies with the same ASR fields as equal', () => {
    const a = baseState();
    const b = {
      ...baseState(),
      language: { ...baseState().language, font: 'other', spellCheck: true },
    };
    expect(asrStatesEqual(a, b)).toBe(true);
  });

  it('detects target changes', () => {
    expect(
      asrStatesEqual(baseState(), {
        ...baseState(),
        target: AsrTarget.phonetic,
      })
    ).toBe(false);
  });

  it('normalizes missing method to mms', () => {
    const withMethod = baseState();
    const withoutMethod = { ...baseState(), method: undefined };
    const withMms = { ...baseState(), method: 'mms' };
    expect(asrStatesEqual(withoutMethod, withMms)).toBe(true);
    expect(asrStatesEqual(withoutMethod, withMethod)).toBe(false);
  });
});

describe('normalizeAsrState', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeAsrState(undefined)).toBeUndefined();
    expect(normalizeAsrState(null)).toBeUndefined();
  });

  it('falls back to the legacy mmsIso key when asrIso is missing', () => {
    const legacy = { target: AsrTarget.alphabet, mmsIso: 'guj' };
    expect(normalizeAsrState(legacy)?.asrIso).toBe('guj');
  });

  it('keeps asrIso when present', () => {
    const current = { asrIso: 'eng', mmsIso: 'old' };
    expect(normalizeAsrState(current)?.asrIso).toBe('eng');
  });
});
