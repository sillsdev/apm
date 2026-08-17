import { jsonBoolean, normalizeLanguage } from './normalizeLanguage';

describe('jsonBoolean', () => {
  it('passes booleans through', () => {
    expect(jsonBoolean(true)).toBe(true);
    expect(jsonBoolean(false)).toBe(false);
  });

  it("coerces string-encoded booleans, including truthy 'false'", () => {
    expect(jsonBoolean('true')).toBe(true);
    expect(jsonBoolean('false')).toBe(false);
  });

  it('falls back to the default for anything else', () => {
    expect(jsonBoolean(undefined)).toBe(false);
    expect(jsonBoolean(null)).toBe(false);
    expect(jsonBoolean('yes')).toBe(false);
    expect(jsonBoolean(undefined, true)).toBe(true);
  });
});

describe('normalizeLanguage', () => {
  it('returns undefined when nothing was stored', () => {
    expect(normalizeLanguage(undefined)).toBeUndefined();
    expect(normalizeLanguage(null)).toBeUndefined();
    expect(normalizeLanguage('')).toBeUndefined();
  });

  it('coerces string-encoded booleans a project record would reject', () => {
    // The org default that broke project creation: rtl persisted as 'false'.
    const lang = normalizeLanguage({
      bcp47: 'seh',
      languageName: 'Sena',
      font: 'charissil',
      rtl: 'false',
      spellCheck: 'true',
    });
    expect(lang).toEqual({
      bcp47: 'seh',
      languageName: 'Sena',
      font: 'charissil',
      rtl: false,
      spellCheck: true,
    });
  });

  it('supplies defaults for missing or mistyped fields', () => {
    expect(normalizeLanguage({})).toEqual({
      bcp47: 'und',
      languageName: '',
      font: '',
      rtl: false,
      spellCheck: false,
    });
  });

  it('preserves extra fields such as the langtag info', () => {
    const info = { tag: 'seh', name: 'Sena' };
    expect(normalizeLanguage({ bcp47: 'seh', info })).toMatchObject({
      bcp47: 'seh',
      info,
    });
  });
});
