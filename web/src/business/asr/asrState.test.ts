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
  asrMethod: 'whisper',
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

  it('treats a missing method as different from a named method', () => {
    const withMethod = baseState();
    const withoutMethod = { ...baseState(), asrMethod: undefined };
    const withDefault = { ...baseState(), asrMethod: 'default' };
    const withMms = { ...baseState(), asrMethod: 'mms' };
    expect(asrStatesEqual(withoutMethod, withDefault)).toBe(true);
    expect(asrStatesEqual(withoutMethod, withMms)).toBe(false);
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

  it('drops the legacy auto-picked method', () => {
    const legacy = { asrIso: 'eng', method: 'mms' };
    const state = normalizeAsrState(legacy);
    expect(state?.asrMethod).toBeUndefined();
    expect(state).not.toHaveProperty('method');
  });

  it('keeps a chosen asrMethod', () => {
    expect(
      normalizeAsrState({ asrIso: 'eng', asrMethod: 'mms' })?.asrMethod
    ).toBe('mms');
  });
});
