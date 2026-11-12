import {
  findDeviceVoice,
  moveRankedVoice,
  parseVoiceRanking,
  rankedLanguages,
  RankedVoice,
  rankVoice,
  unrankVoice,
  voiceLanguage,
} from './voiceRanking';

const voice = (
  name: string,
  lang = 'en-US',
  over: Partial<RankedVoice> = {}
): RankedVoice => ({
  name,
  voiceURI: name,
  lang,
  localService: true,
  ...over,
});

const david = voice('David');
const zira = voice('Zira');
const mark = voice('Mark');
const amelie = voice('Amelie', 'fr-FR');

describe('voiceLanguage', () => {
  it('is the canonical primary subtag', () => {
    expect(voiceLanguage('eng')).toBe('en');
    expect(voiceLanguage('en-GB')).toBe('en');
    expect(voiceLanguage('fr_FR')).toBe('fr');
    expect(voiceLanguage('cmn-CN')).toBe('zh');
  });
});

describe('findDeviceVoice', () => {
  it('matches the voiceURI first, then the name', () => {
    const local = voice('Zira', 'en-US', { voiceURI: 'urn:zira' });
    expect(findDeviceVoice([david, zira], zira)).toBe(zira);
    expect(findDeviceVoice([david, local], zira)).toBe(local);
    expect(findDeviceVoice([david], zira)).toBeUndefined();
    expect(findDeviceVoice([], zira)).toBeUndefined();
  });
});

describe('parseVoiceRanking', () => {
  it('keeps well-formed voices and drops empty languages', () => {
    expect(
      parseVoiceRanking({
        en: [david, { name: 'broken' }],
        fr: [],
        de: 'nope',
      })
    ).toEqual({ en: [david] });
  });

  it('drops extra fields a device voice carries', () => {
    expect(parseVoiceRanking({ en: [{ ...david, default: true }] })).toEqual({
      en: [david],
    });
  });

  it('is empty for anything that is not a ranking', () => {
    expect(parseVoiceRanking(undefined)).toEqual({});
    expect(parseVoiceRanking('{}')).toEqual({});
    expect(parseVoiceRanking([david])).toEqual({});
  });
});

describe('rankedLanguages', () => {
  it('lists languages with a ranked voice', () => {
    expect([...rankedLanguages({ en: [david], fr: [] })]).toEqual(['en']);
    expect(rankedLanguages({}).size).toBe(0);
  });
});

describe('rankVoice', () => {
  it('appends to the voice language and ignores repeats', () => {
    const one = rankVoice({}, david);
    const two = rankVoice(one, zira);
    expect(two).toEqual({ en: [david, zira] });
    expect(rankVoice(two, david)).toBe(two);
    expect(rankVoice(two, amelie)).toEqual({ en: [david, zira], fr: [amelie] });
  });

  it('does not change the ranking it was given', () => {
    const ranking = { en: [david] };
    rankVoice(ranking, zira);
    expect(ranking).toEqual({ en: [david] });
  });
});

describe('unrankVoice', () => {
  it('removes the voice and drops a language that empties', () => {
    const ranking = { en: [david, zira], fr: [amelie] };
    expect(unrankVoice(ranking, david)).toEqual({ en: [zira], fr: [amelie] });
    expect(unrankVoice(ranking, amelie)).toEqual({ en: [david, zira] });
    expect(unrankVoice({}, david)).toEqual({});
  });
});

describe('moveRankedVoice', () => {
  const ranking = { en: [david, zira, mark] };

  it('swaps the voice with its neighbour', () => {
    expect(moveRankedVoice(ranking, zira, -1)).toEqual({
      en: [zira, david, mark],
    });
    expect(moveRankedVoice(ranking, zira, 1)).toEqual({
      en: [david, mark, zira],
    });
  });

  it('stays put at either end or for an unranked voice', () => {
    expect(moveRankedVoice(ranking, david, -1)).toBe(ranking);
    expect(moveRankedVoice(ranking, mark, 1)).toBe(ranking);
    expect(moveRankedVoice(ranking, amelie, 1)).toBe(ranking);
  });
});
