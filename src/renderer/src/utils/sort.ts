import { GridSortModel } from '@mui/x-data-grid';
import { DateTime } from 'luxon';

export function numCompare(a: number, b: number): number {
  return a - b;
}
export function strNumCompare(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (isNaN(numA) && isNaN(numB)) return 0;
  if (isNaN(numA)) return 1;
  if (isNaN(numB)) return -1;
  return numA - numB;
}
export function strCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Attempt to parse using several common formats (replacement for prior moment fallback including 'LT').
function parseFlexible(value: string): DateTime {
  let dt = DateTime.fromISO(value);
  if (!dt.isValid) dt = DateTime.fromRFC2822(value);
  if (!dt.isValid) dt = DateTime.fromSQL(value);
  // Try common time-only patterns that might correspond to moment's localized 'LT'
  if (!dt.isValid) dt = DateTime.fromFormat(value, 'h:mm a');
  if (!dt.isValid) dt = DateTime.fromFormat(value, 'H:mm');
  return dt;
}

export function dateCompare(a: string, b: string): number {
  const aDate = parseFlexible(a);
  const bDate = parseFlexible(b);
  const aIso = aDate.isValid ? (aDate.toISO() ?? '') : '';
  const bIso = bDate.isValid ? (bDate.toISO() ?? '') : '';
  if (aIso > bIso) return 1;
  if (aIso < bIso) return -1;
  return 0;
}

/**
 * Normalizes a reference string by zero-padding all numeric parts for proper string sorting
 * Examples:
 *   normalizeReference("Lk", "1:1-4") -> "Lk 001:001-004"
 *   normalizeReference("Lk", "1:14-2:20") -> "Lk 001:014-002:020"
 *   normalizeReference("Lk", "1:1") -> "Lk 001:001"
 *   Non-numeric references are returned as-is with book prepended
 * @param book - Book abbreviation (e.g., "Lk", "Mt")
 * @param ref - Reference string in format "[Chapter]:[StartVerse]-[EndVerse]" or "[Chapter]:[StartVerse]-[EndChapter]:[EndVerse]"
 * @returns Normalized reference string with zero-padded numbers
 */
export function normalizeReference(book: string, ref: string): string {
  if (!ref || typeof ref !== 'string') {
    return book ? `${book} ${ref}` : ref;
  }

  // Match pattern: [Chapter]:[StartVerse]-[EndVerse or EndChapter:EndVerse]
  // Examples: "1:1-4", "1:14-2:20", "5:10-12", "1:1"
  const match = ref.match(/^(\d+):(\d+)(?:-(\d+)(?::(\d+))?)?$/);
  if (!match) {
    // Return as-is if it doesn't match the pattern (non-numeric references)
    return book ? `${book} ${ref}` : ref;
  }

  const [, chapterStr, startVerseStr, endVerseOrChapterStr, endVerseStr] =
    match;

  // Pad chapter and start verse to 3 digits
  const chapter = chapterStr.padStart(3, '0');
  const startVerse = startVerseStr.padStart(3, '0');

  // Handle end verse
  if (endVerseStr) {
    // Cross-chapter reference: "1:14-2:20"
    const endChapter = endVerseOrChapterStr.padStart(3, '0');
    const endVerse = endVerseStr.padStart(3, '0');
    return `${book} ${chapter}:${startVerse}-${endChapter}:${endVerse}`;
  } else if (endVerseOrChapterStr) {
    // Simple verse range: "1:1-4"
    const endVerse = endVerseOrChapterStr.padStart(3, '0');
    return `${book} ${chapter}:${startVerse}-${endVerse}`;
  } else {
    // Single verse: "1:1"
    return `${book} ${chapter}:${startVerse}`;
  }
}
export const doSort =
  (sortModel: GridSortModel) =>
  (a: Record<string, any>, b: Record<string, any>) => {
    if (sortModel.length === 0) return 0;
    for (const sort of sortModel) {
      const field = sort.field;
      const direction = sort.sort === 'asc' ? 1 : -1;
      let result = 0;
      if (field === 'version') {
        result = strNumCompare(a[field] ?? '0', b[field] ?? '0') * direction;
      } else if (field === 'date') {
        result = dateCompare(a[field] ?? '', b[field] ?? '') * direction;
      } else if (field === 'passage' || field === 'reference') {
        // Use referenceString for sorting since reference is a React node
        // referenceString is already normalized with zero-padding, so simple string compare works
        const aRef =
          field === 'reference' ? (a.referenceString ?? '') : (a[field] ?? '');
        const bRef =
          field === 'reference' ? (b.referenceString ?? '') : (b[field] ?? '');
        result = strCompare(aRef, bRef) * direction;
      } else {
        result = strCompare(a[field] ?? '', b[field] ?? '') * direction;
      }
      if (result !== 0) return result;
    }
    return 0;
  };
