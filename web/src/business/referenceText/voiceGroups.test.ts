import { voiceGroups, VoiceGroupsOptions, voiceProvider } from './voiceGroups';
import type { RankedVoice } from './voiceRanking';

const voice = (
  name: string,
  lang: string,
  localService = true
): RankedVoice => ({ name, voiceURI: name, lang, localService });

const david = voice('Microsoft David', 'en-US');
const zira = voice('Microsoft Zira', 'en-US');
const googleUk = voice('Google UK English Female', 'en-GB', false);
const amelie = voice('Amelie', 'fr-FR');
const hoda = voice('Microsoft Hoda', 'ar-EG');
const mark = voice('Microsoft Mark', 'en-US');

const labels: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
};

const options = (
  over: Partial<VoiceGroupsOptions<RankedVoice>> = {}
): VoiceGroupsOptions<RankedVoice> => ({
  deviceVoices: [david, zira, googleUk, amelie, hoda],
  ranking: {},
  savedRanking: {},
  usedLanguages: new Set(),
  showOnline: false,
  search: '',
  languageLabel: (l) => labels[l] ?? l,
  collator: new Intl.Collator('en'),
  ...over,
});

const summary = (over: Partial<VoiceGroupsOptions<RankedVoice>> = {}) =>
  voiceGroups(options(over)).map((g) => ({
    language: g.language,
    tier: g.tier,
    rows: g.rows.map((r) => [r.voice.name, r.rank, Boolean(r.device)]),
  }));

describe('voiceGroups', () => {
  it('groups by language A–Z with local voices only by default', () => {
    expect(summary()).toEqual([
      {
        language: 'ar',
        tier: 'other',
        rows: [['Microsoft Hoda', undefined, true]],
      },
      {
        language: 'en',
        tier: 'other',
        rows: [
          ['Microsoft David', undefined, true],
          ['Microsoft Zira', undefined, true],
        ],
      },
      { language: 'fr', tier: 'other', rows: [['Amelie', undefined, true]] },
    ]);
  });

  it('lists online voices when asked', () => {
    const en = summary({ showOnline: true }).find((g) => g.language === 'en');
    expect(en?.rows.map((r) => r[0])).toContain(googleUk.name);
  });

  it('puts ranked voices first in rank order, without repeating them', () => {
    const en = summary({ ranking: { en: [zira, googleUk] } }).find(
      (g) => g.language === 'en'
    );
    expect(en?.rows).toEqual([
      ['Microsoft Zira', 1, true],
      ['Google UK English Female', 2, true],
      ['Microsoft David', undefined, true],
    ]);
  });

  it('keeps a ranked voice the device lacks', () => {
    const en = summary({ ranking: { en: [mark] } }).find(
      (g) => g.language === 'en'
    );
    expect(en?.rows[0]).toEqual(['Microsoft Mark', 1, false]);
  });

  it('lists a ranked language the device has no voice for', () => {
    const de = voice('Hedda', 'de-DE');
    expect(summary({ deviceVoices: [], ranking: { de: [de] } })).toEqual([
      { language: 'de', tier: 'other', rows: [['Hedda', 1, false]] },
    ]);
  });

  it('orders by the saved ranking, then languages the team uses, then the rest', () => {
    expect(
      summary({
        savedRanking: { fr: [amelie] },
        ranking: { fr: [amelie], ar: [hoda] },
        usedLanguages: new Set(['en']),
      }).map((g) => [g.language, g.tier])
    ).toEqual([
      ['fr', 'ranked'],
      ['en', 'used'],
      ['ar', 'other'],
    ]);
  });

  it('searches language names, codes and voice names', () => {
    const langs = (search: string) =>
      voiceGroups(options({ search })).map((g) => g.language);
    expect(langs('fren')).toEqual(['fr']);
    expect(langs(' AR ')).toEqual(['ar']);
    expect(langs('zira')).toEqual(['en']);
    expect(langs('klingon')).toEqual([]);
  });

  it('is empty when there are no voices and no ranking', () => {
    expect(voiceGroups(options({ deviceVoices: [] }))).toEqual([]);
  });
});

describe('voiceProvider', () => {
  it('names the company from the voice name', () => {
    expect(voiceProvider(googleUk)).toBe('Google');
    expect(
      voiceProvider({ name: 'Microsoft Ava Online (Natural) - English' })
    ).toBe('Microsoft');
    expect(voiceProvider(amelie)).toBeUndefined();
  });
});
