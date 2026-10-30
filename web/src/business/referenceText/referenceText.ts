import codeNum from '../../assets/code-num.json';
import akuoSort from '../../assets/akuosort.json';
import { langName, UiLoc } from '../../utils/langName';
import { IVProjectStrings } from '../../model';

/** One entry of the bundled Reference Text catalog (`reference_text_bibles.json`). */
export interface CatalogBible {
  /** HelloAO translation id, e.g. `BSB` or `eng_kjv`. */
  id: string;
  /** Where the Bible's text comes from. */
  type: 'helloao';
  /** Title in the Bible's own language. */
  name: string;
  englishName: string;
  shortName?: string;
  /** ISO 639-3 code, e.g. `eng` or `arb`. */
  language: string;
  /** Autonym, e.g. `العربية`. */
  languageName?: string;
  languageEnglishName?: string;
  textDirection: 'ltr' | 'rtl';
  /** e.g. `CC BY-SA` or `Public Domain`; '' when HelloAO gives none. */
  license: string;
  licenseUrl?: string;
  website?: string;
  /** Canonical USFM books the Bible has, space separated. */
  books: string;
}

/** Snapshot of a catalog entry kept in `defaultParams.referenceTexts` (ADR 0014). */
export type ReferenceText = Pick<
  CatalogBible,
  | 'id'
  | 'name'
  | 'englishName'
  | 'language'
  | 'languageName'
  | 'languageEnglishName'
  | 'textDirection'
  | 'license'
  | 'licenseUrl'
  | 'books'
>;

export type Testament = 'OT' | 'NT';

export type ReferenceTextRank = 'primary' | 'secondary';

// defaultParams.referenceTexts is ordered Primary then Secondary (ADR 0014)
const rankIndex: Record<ReferenceTextRank, number> = {
  primary: 0,
  secondary: 1,
};

/** The rank's entry in a Primary-then-Secondary list. */
export const byRank = <T>(rank: ReferenceTextRank, values: readonly T[]): T =>
  values[rankIndex[rank]];

export const PUBLIC_DOMAIN = 'Public Domain';

/** A catalog license in the UI language; only "Public Domain" and a missing license are translated. */
export const licenseText = (
  license: string,
  t: Pick<IVProjectStrings, 'licenseNotStated' | 'publicDomain'>
) => {
  if (!license) return t.licenseNotStated;
  return license === PUBLIC_DOMAIN ? t.publicDomain : license;
};

const FIRST_NT_BOOK = 40;
const LAST_NT_BOOK = 66;

const bookNums = new Map(codeNum as [string, number][]);
const usfmToSlotMap = new Map(akuoSort as [string, string][]);
const slotToUsfmMap = new Map(
  (akuoSort as [string, string][]).map(([usfm, slot]) => [slot, usfm])
);

/** Testament of a canonical USFM book; undefined for deuterocanon and extra material. */
export const bookTestament = (usfm: string): Testament | undefined => {
  const num = bookNums.get(usfm) ?? 0;
  if (num < 1 || num > LAST_NT_BOOK) return undefined;
  return num < FIRST_NT_BOOK ? 'OT' : 'NT';
};

export const hasBook = (bible: Pick<CatalogBible, 'books'>, usfm: string) =>
  bible.books.split(' ').includes(usfm);

/** Catalog entries that have the book; none when the book is not canonical. */
export const biblesForBook = (bibles: CatalogBible[], usfm: string) => {
  if (!bookTestament(usfm)) return [];
  return bibles.filter((b) => hasBook(b, usfm));
};

/** Splits chosen Reference Texts into those that still have the book and those that don't. */
export const partitionByBook = (texts: ReferenceText[], usfm: string) => {
  const canonical = bookTestament(usfm) !== undefined;
  const kept: ReferenceText[] = [];
  const removed: ReferenceText[] = [];
  texts.forEach((r) =>
    (canonical && hasBook(r, usfm) ? kept : removed).push(r)
  );
  return { kept, removed };
};

export const toReferenceText = (bible: CatalogBible): ReferenceText => ({
  id: bible.id,
  name: bible.name,
  englishName: bible.englishName,
  language: bible.language,
  languageName: bible.languageName,
  languageEnglishName: bible.languageEnglishName,
  textDirection: bible.textDirection,
  license: bible.license,
  licenseUrl: bible.licenseUrl,
  books: bible.books,
});

/** BCP 47 form of an ISO 639-3 code (`eng` → `en`, `arb` → `ar`), for CLDR and voice lookups. */
export const canonicalLanguage = (iso639_3: string) => {
  try {
    return Intl.getCanonicalLocales(iso639_3)[0] ?? iso639_3;
  } catch {
    return iso639_3;
  }
};

/**
 * The Bible's language named in the UI language when CLDR has it, else its
 * English name with the autonym when that differs, else its code.
 */
export const languageLabel = (
  bible: Pick<
    CatalogBible,
    'language' | 'languageName' | 'languageEnglishName'
  >,
  uiLang: string
) => {
  const localized = langName(
    uiLang as UiLoc,
    canonicalLanguage(bible.language)
  );
  if (localized) return localized;
  const { languageEnglishName: english, languageName: autonym } = bible;
  // First-strong isolate keeps an RTL autonym from reordering the English name.
  if (english && autonym && autonym !== english)
    return `${english} (⁨${autonym}⁩)`;
  return english || autonym || bible.language;
};

/** The Bible's own title, with its English title when the UI is in another language. */
export const bibleLabel = (
  bible: Pick<CatalogBible, 'name' | 'englishName' | 'language'>,
  uiLang: string
) => {
  const sameLanguage =
    canonicalLanguage(bible.language).split('-')[0] === uiLang.split('-')[0];
  return sameLanguage || !bible.englishName || bible.englishName === bible.name
    ? bible.name
    : `${bible.name} (${bible.englishName})`;
};

/** USFM code for a scripture Project Book slot (A01–A39, B01–B27); undefined otherwise. */
export const projectBookToUsfm = (slot: string | undefined) => {
  if (!slot || !/^[AB]\d\d$/.test(slot)) return undefined;
  const usfm = slotToUsfmMap.get(slot);
  return usfm && bookTestament(usfm) ? usfm : undefined;
};

/** Project Book slot for a canonical USFM book. */
export const usfmToProjectBook = (usfm: string) =>
  bookTestament(usfm) ? usfmToSlotMap.get(usfm) : undefined;

const isCatalogBible = (v: unknown): v is CatalogBible => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.language === 'string' &&
    typeof r.license === 'string' &&
    typeof r.books === 'string'
  );
};

/** Entries of a catalog file that have the fields the pickers rely on. */
export const parseCatalog = (json: unknown): CatalogBible[] => {
  const bibles = (json as { bibles?: unknown } | undefined)?.bibles;
  return Array.isArray(bibles) ? bibles.filter(isCatalogBible) : [];
};

/** Ids of the Reference Texts saved on several projects, without repeats. */
export const usedReferenceTextIds = (saved: unknown[]) =>
  new Set(saved.flatMap((v) => parseReferenceTexts(v).map((r) => r.id)));

/** Reference Texts read back from `defaultParams`, dropping malformed and open.bible-era entries. */
export const parseReferenceTexts = (value: unknown): ReferenceText[] =>
  Array.isArray(value) ? value.filter(isCatalogBible) : [];
