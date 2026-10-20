import { parseTranscribeStepSettings } from './transcribeStepSettings';

describe('parseTranscribeStepSettings', () => {
  const full = {
    artifactTypeId: 'art-1',
    language: 'French|fr',
    sisterlanguage: 'English|en',
    font: 'Charis SIL',
    fontSize: 'large',
    rtl: true,
    spellCheck: false,
    namedRegion: 'clause',
  };

  test('parses a JSON string', () => {
    expect(parseTranscribeStepSettings(JSON.stringify(full))).toEqual(full);
  });

  test('accepts an already parsed object (offline Work Alone steps)', () => {
    expect(parseTranscribeStepSettings(full)).toEqual(full);
  });

  test('keeps a language stored as an object', () => {
    const language = { languageName: 'French', bcp47: 'fr' };
    expect(
      parseTranscribeStepSettings(JSON.stringify({ language })).language
    ).toEqual(language);
  });

  test('keeps keys it does not know about', () => {
    expect(
      parseTranscribeStepSettings(JSON.stringify({ asr: { target: 'x' } }))
    ).toEqual({ asr: { target: 'x' } });
  });

  test('reads legacy boolean strings as booleans', () => {
    expect(
      parseTranscribeStepSettings(
        JSON.stringify({ rtl: 'true', spellCheck: 'false' })
      )
    ).toEqual({ rtl: true, spellCheck: false });
  });

  test('drops known fields with the wrong type', () => {
    expect(
      parseTranscribeStepSettings(
        JSON.stringify({
          artifactTypeId: 7,
          language: 3,
          sisterlanguage: null,
          font: false,
          fontSize: 12,
          rtl: 'yes',
          spellCheck: 0,
          namedRegion: [],
        })
      )
    ).toEqual({});
  });

  test('returns empty settings for missing, invalid or non-object input', () => {
    expect(parseTranscribeStepSettings(undefined)).toEqual({});
    expect(parseTranscribeStepSettings(null)).toEqual({});
    expect(parseTranscribeStepSettings('')).toEqual({});
    expect(parseTranscribeStepSettings('{not json')).toEqual({});
    expect(parseTranscribeStepSettings('null')).toEqual({});
    expect(parseTranscribeStepSettings('"text"')).toEqual({});
    expect(parseTranscribeStepSettings('[1]')).toEqual({});
    expect(parseTranscribeStepSettings(42)).toEqual({});
  });
});
