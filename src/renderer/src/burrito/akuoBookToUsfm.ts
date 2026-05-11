/**
 * Maps an Akuo-style project book slot (e.g. A01, B02 from project `book` default)
 * to a Paratext/USFM 3-letter book code using the same numbering as ApmData export.
 */
export function akuoBookToUsfm(
  akuoBook: string,
  num2BookCode: (bookNum: number) => string | undefined
): string | undefined {
  const bookParse = /^([AB])(\d\d)$/.exec(akuoBook.trim());
  if (!bookParse) return undefined;
  const bookNum =
    bookParse[1] === 'A'
      ? parseInt(bookParse[2], 10)
      : bookParse[1] === 'B'
        ? parseInt(bookParse[2], 10) + 39
        : 999;
  return num2BookCode(bookNum);
}

/**
 * Maps a project's `book` default (Akuo A##/B## or a general-resource 3-digit code)
 * to the burrito book key used in `burritoBooks`, export folder names, and section grouping.
 */
export function projectDefaultToBurritoBookKey(
  projectBookDefault: string | undefined,
  num2BookCode: (bookNum: number) => string | undefined
): string | undefined {
  const def = (projectBookDefault ?? 'B01').trim();
  if (!def) return undefined;
  const mapped = akuoBookToUsfm(def, num2BookCode);
  if (mapped) return mapped;
  if (/^\d{3}$/.test(def)) return def;
  return undefined;
}
