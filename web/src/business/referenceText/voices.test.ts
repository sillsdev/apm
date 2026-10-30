import { pickVoice } from './voices';

const voice = (
  lang: string,
  name: string,
  over: Partial<SpeechSynthesisVoice> = {}
) =>
  ({
    lang,
    name,
    voiceURI: name,
    localService: true,
    default: false,
    ...over,
  }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
  it('matches the canonical language on the primary subtag', () => {
    const ar = voice('ar-EG', 'Hoda');
    expect(pickVoice([voice('en-US', 'David'), ar], 'arb')).toBe(ar);
  });

  it('finds nothing when no voice speaks the language', () => {
    expect(pickVoice([voice('en-US', 'David')], 'arb')).toBeUndefined();
  });

  it('does not match a language that only shares a prefix', () => {
    expect(pickVoice([voice('en-US', 'David')], 'enm')).toBeUndefined();
  });

  it('prefers the default voice', () => {
    const zira = voice('en-US', 'Zira', { default: true });
    expect(pickVoice([voice('en-GB', 'Hazel'), zira], 'eng')).toBe(zira);
  });

  it('prefers a local voice over a network one', () => {
    const local = voice('en-US', 'David');
    expect(
      pickVoice(
        [voice('en-US', 'Google US English', { localService: false }), local],
        'eng'
      )
    ).toBe(local);
  });

  it('uses a network voice when it is the only match', () => {
    const zh = voice('zh-CN', 'Google 普通话', { localService: false });
    expect(pickVoice([zh], 'cmn')).toBe(zh);
  });

  it('canonicalizes the voice tag too', () => {
    const cmn = voice('cmn-CN', 'Tingting');
    expect(pickVoice([cmn], 'cmn')).toBe(cmn);
  });

  it('accepts underscore tags some platforms report', () => {
    const fr = voice('fr_FR', 'Amelie');
    expect(pickVoice([fr], 'fra')).toBe(fr);
  });

  it("prefers the team's first ranked voice the device has", () => {
    const david = voice('en-US', 'David', { default: true });
    const zira = voice('en-US', 'Zira');
    const ranking = {
      en: [
        { name: 'Mark', voiceURI: 'Mark', lang: 'en-US', localService: true },
        { name: 'Zira', voiceURI: 'Zira', lang: 'en-US', localService: true },
      ],
    };
    expect(pickVoice([david, zira], 'eng', ranking)).toBe(zira);
  });

  it('matches a ranked voice by name when its voiceURI differs here', () => {
    const zira = voice('en-US', 'Zira', { voiceURI: 'urn:zira-local' });
    const ranking = {
      en: [
        { name: 'Zira', voiceURI: 'Zira', lang: 'en-US', localService: true },
      ],
    };
    expect(
      pickVoice(
        [voice('en-US', 'David', { default: true }), zira],
        'eng',
        ranking
      )
    ).toBe(zira);
  });

  it('falls back when no ranked voice is on the device', () => {
    const david = voice('en-US', 'David', { default: true });
    const ranking = {
      en: [
        { name: 'Mark', voiceURI: 'Mark', lang: 'en-US', localService: true },
      ],
    };
    expect(pickVoice([david], 'eng', ranking)).toBe(david);
  });

  it("ignores another language's ranking", () => {
    const hazel = voice('en-GB', 'Hazel');
    const ranking = {
      fr: [
        { name: 'Hazel', voiceURI: 'Hazel', lang: 'en-GB', localService: true },
      ],
    };
    expect(pickVoice([hazel], 'fra', ranking)).toBeUndefined();
  });
});
