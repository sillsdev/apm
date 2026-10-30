import {
  bibleLabel,
  biblesForBook,
  bookTestament,
  canonicalLanguage,
  CatalogBible,
  hasBook,
  languageLabel,
  parseCatalog,
  parseReferenceTexts,
  partitionByBook,
  projectBookToUsfm,
  toReferenceText,
  usedReferenceTextIds,
  usfmToProjectBook,
} from './referenceText';

const bible = (id: string, books: string): CatalogBible => ({
  id,
  type: 'helloao',
  name: id,
  englishName: id,
  shortName: id.toUpperCase(),
  language: 'eng',
  languageName: 'English',
  languageEnglishName: 'English',
  textDirection: 'ltr',
  license: 'CC BY',
  books,
});

const nt = bible('nt', 'MAT MRK LUK JHN');
const ot = bible('ot', 'GEN EXO');
const whole = bible('whole', 'GEN EXO MAT MRK LUK JHN');
const portion = bible('portion', 'RUT JON');
const all = [nt, ot, whole, portion];

describe('bookTestament', () => {
  it('puts Genesis and Malachi in the OT', () => {
    expect(bookTestament('GEN')).toBe('OT');
    expect(bookTestament('MAL')).toBe('OT');
  });
  it('puts Matthew and Revelation in the NT', () => {
    expect(bookTestament('MAT')).toBe('NT');
    expect(bookTestament('REV')).toBe('NT');
  });
  it('has no testament for deuterocanon, extras, or unknown codes', () => {
    expect(bookTestament('TOB')).toBeUndefined();
    expect(bookTestament('FRT')).toBeUndefined();
    expect(bookTestament('')).toBeUndefined();
  });
});

describe('hasBook', () => {
  it('matches whole book ids only', () => {
    expect(hasBook(nt, 'LUK')).toBe(true);
    expect(hasBook(bible('x', '1JN 2JN'), 'JN')).toBe(false);
  });
});

describe('biblesForBook', () => {
  it('offers only Bibles that have the exact book', () => {
    expect(biblesForBook(all, 'LUK')).toEqual([nt, whole]);
    expect(biblesForBook(all, 'GEN')).toEqual([ot, whole]);
    expect(biblesForBook(all, 'JON')).toEqual([portion]);
  });
  it('offers nothing without a canonical book', () => {
    expect(biblesForBook(all, '')).toEqual([]);
    expect(biblesForBook(all, 'TOB')).toEqual([]);
    expect(biblesForBook([], 'LUK')).toEqual([]);
  });
});

describe('partitionByBook', () => {
  it('keeps texts that have the new book and removes the rest', () => {
    const texts = [toReferenceText(nt), toReferenceText(whole)];
    const { kept, removed } = partitionByBook(texts, 'GEN');
    expect(kept.map((r) => r.id)).toEqual(['whole']);
    expect(removed.map((r) => r.id)).toEqual(['nt']);
  });
  it('removes everything when the book is cleared', () => {
    const { kept, removed } = partitionByBook([toReferenceText(whole)], '');
    expect(kept).toEqual([]);
    expect(removed).toHaveLength(1);
  });
});

describe('Project Book slots', () => {
  it('maps canonical books both ways', () => {
    expect(usfmToProjectBook('GEN')).toBe('A01');
    expect(usfmToProjectBook('MAT')).toBe('B01');
    expect(projectBookToUsfm(usfmToProjectBook('LUK'))).toBe('LUK');
  });
  it('ignores general codes, sort keys, and deuterocanon slots', () => {
    expect(projectBookToUsfm('010')).toBeUndefined();
    expect(projectBookToUsfm('A0104')).toBeUndefined();
    expect(projectBookToUsfm('A40')).toBeUndefined();
    expect(projectBookToUsfm(undefined)).toBeUndefined();
    expect(usfmToProjectBook('TOB')).toBeUndefined();
  });
});

describe('canonicalLanguage', () => {
  it('maps ISO 639-3 codes to their BCP 47 form', () => {
    expect(canonicalLanguage('eng')).toBe('en');
    expect(canonicalLanguage('arb')).toBe('ar');
    expect(canonicalLanguage('cmn')).toBe('zh');
    expect(canonicalLanguage('mgj')).toBe('mgj');
  });
  it('returns codes Intl rejects unchanged', () => {
    expect(canonicalLanguage('x')).toBe('x');
  });
});

describe('languageLabel', () => {
  const arabic = {
    language: 'arb',
    languageName: 'العربية',
    languageEnglishName: 'Arabic',
  };
  const abureni = {
    language: 'mgj',
    languageName: 'Abureni',
    languageEnglishName: 'Abureni',
  };
  it('names the language in the UI language when CLDR has it', () => {
    expect(languageLabel(arabic, 'fr')).toBe('arabe');
    expect(languageLabel(arabic, 'en')).toBe('Arabic');
  });
  it('falls back to the English name with an isolated autonym', () => {
    expect(languageLabel({ ...arabic, language: 'zzz' }, 'fr')).toBe(
      'Arabic (⁨العربية⁩)'
    );
  });
  it('shows the English name alone when it matches the autonym', () => {
    expect(languageLabel(abureni, 'fr')).toBe('Abureni');
  });
  it('falls back to the code without names', () => {
    expect(languageLabel({ language: 'cug' }, 'fr')).toBe('cug');
  });
});

describe('bibleLabel', () => {
  const reinaValera = {
    name: 'Reina Valera',
    englishName: 'Spanish Reina Valera',
    language: 'spa',
  };
  it('adds the English title when the UI is in another language', () => {
    expect(bibleLabel(reinaValera, 'fr')).toBe(
      'Reina Valera (Spanish Reina Valera)'
    );
  });
  it('shows only the title when the UI is in the Bible’s language', () => {
    expect(bibleLabel(reinaValera, 'es')).toBe('Reina Valera');
  });
  it('does not repeat an identical English title', () => {
    expect(
      bibleLabel({ ...reinaValera, englishName: 'Reina Valera' }, 'fr')
    ).toBe('Reina Valera');
  });
});

describe('parseCatalog and parseReferenceTexts', () => {
  it('drops malformed entries', () => {
    expect(parseCatalog({ bibles: [nt, { name: 'x' }, null] })).toEqual([nt]);
    expect(parseCatalog(undefined)).toEqual([]);
    expect(parseCatalog({ bibles: 'nope' })).toEqual([]);
  });
  it('drops open.bible-era snapshots, which have no book list', () => {
    const openBible = {
      id: '5f5a7e4f',
      name: 'Berean Standard Bible',
      language: 'English',
      languageCode: 'eng',
      scope: 'Bible',
      license: 'Public Domain',
      usxUrl: 'https://api.open.bible/artifactContent/5f5a7e4f',
    };
    expect(parseReferenceTexts([toReferenceText(nt), openBible])).toEqual([
      toReferenceText(nt),
    ]);
    expect(parseReferenceTexts('[]')).toEqual([]);
  });
});

describe('usedReferenceTextIds', () => {
  it('merges projects, skipping repeats and projects without texts', () => {
    const a = toReferenceText(nt);
    const b = toReferenceText(whole);
    expect([...usedReferenceTextIds([[a, b], undefined, [a]])]).toEqual([
      a.id,
      b.id,
    ]);
    expect(usedReferenceTextIds([]).size).toBe(0);
  });
});
