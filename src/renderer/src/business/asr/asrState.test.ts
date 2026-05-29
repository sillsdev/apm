import { AsrTarget } from './AsrTarget';
import { IAsrState, asrStatesEqual } from './asrState';

const baseState = (): IAsrState => ({
  target: AsrTarget.alphabet,
  language: {
    bcp47: 'en',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  mmsIso: 'eng',
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
