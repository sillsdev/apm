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
});
