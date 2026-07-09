/** Passage verse list helpers for Mark Verses Edit Reference. */

export interface PassageVerseOption {
  chapter: number;
  verse: number;
  /** Stable select value, e.g. `2:11`. */
  key: string;
}

const normalizeRef = (value: string) =>
  value.replace(/[–—]/g, '-').replace(/\s+/g, '').trim();

const MARK_VERSES_LETTER_SUFFIX = /^[a-e]$/i;

export const normalizeMarkVersesLetterSuffix = (suffix: string) =>
  MARK_VERSES_LETTER_SUFFIX.test(suffix) ? suffix.toLowerCase() : '';

export interface VerseNumberAndSuffix {
  verseNumber: number;
  verseLetterSuffix: string;
}

/**
 * Split a single verse token into its numeric verse and optional letter suffix.
 * Accepts a bare number (`2` or `"2"`) or a string carrying a Mark Verses letter
 * suffix (`"2b"` -> `{ verseNumber: 2, verseLetterSuffix: 'b' }`). A missing or unrecognized
 * suffix yields `''`. Returns `undefined` when there is no verse number
 * (empty/nullish input, or trailing garbage such as `"2bb"`).
 */
export const splitVerseSuffix = (
  value: string | number | null | undefined
): VerseNumberAndSuffix | undefined => {
  if (value === null || value === undefined) return undefined;
  const match = /^(\d+)([a-e]?)$/i.exec(String(value).trim());
  if (!match) return undefined;
  return {
    verseNumber: parseInt(match[1], 10),
    verseLetterSuffix: normalizeMarkVersesLetterSuffix(match[2] ?? ''),
  };
};

export interface ParsedMarkVersesReferencePart {
  chapter: number;
  verse: number;
  verseLetterSuffix: string;
}

export interface ParsedMarkVersesReference {
  start: ParsedMarkVersesReferencePart;
  end: ParsedMarkVersesReferencePart;
}

const parseMarkVersesReferencePart = (
  value: string,
  fallbackChapter: number,
  isRangeEnd = false
): ParsedMarkVersesReferencePart | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (isRangeEnd && /^\d+$/.test(trimmed)) {
    return {
      chapter: fallbackChapter,
      verse: parseInt(trimmed, 10),
      verseLetterSuffix: '',
    };
  }

  const match = /^(?:(\d+):)?(\d+[a-e]?)$/i.exec(trimmed);
  if (!match) return undefined;

  const versePart = splitVerseSuffix(match[2]);
  if (!versePart) return undefined;

  return {
    chapter: match[1] ? parseInt(match[1], 10) : fallbackChapter,
    verse: versePart.verseNumber,
    verseLetterSuffix: versePart.verseLetterSuffix,
  };
};

/** Parse a table reference (single verse or range). */
export const parseMarkVersesReference = (
  value: string
): ParsedMarkVersesReference | undefined => {
  const normalized = normalizeRef(value);
  if (!normalized) return undefined;

  const dash = normalized.indexOf('-');
  if (dash < 0) {
    const single = parseMarkVersesReferencePart(normalized, 0);
    if (!single) return undefined;
    return { start: single, end: single };
  }

  const startText = normalized.slice(0, dash);
  const endText = normalized.slice(dash + 1);
  const start = parseMarkVersesReferencePart(startText, 0);
  if (!start) return undefined;

  // Bare letter suffix (e.g. "e" in "1:1a-e"): inherit chapter and verse from start.
  if (MARK_VERSES_LETTER_SUFFIX.test(endText)) {
    return {
      start,
      end: {
        chapter: start.chapter,
        verse: start.verse,
        verseLetterSuffix: endText.toLowerCase(),
      },
    };
  }

  const end = parseMarkVersesReferencePart(endText, start.chapter, true);
  if (!end) return undefined;
  return { start, end };
};

export const markVersesReferenceHasLetterSuffix = (
  parsed: ParsedMarkVersesReference
) =>
  Boolean(parsed.start.verseLetterSuffix) ||
  Boolean(parsed.end.verseLetterSuffix);

/** Returns `'b'` for `'a'`, `'c'` for `'b'`, ... up to `'e'`. Returns `undefined` past `'e'`, for empty input, or non-letter input. */
export const nextMarkVersesLetterSuffix = (
  suffix: string
): string | undefined => {
  const normalized = normalizeMarkVersesLetterSuffix(suffix);
  if (!normalized) return undefined;
  if (normalized === 'e') return undefined;
  return String.fromCharCode(normalized.charCodeAt(0) + 1);
};

/** If `ref` ends with a letter suffix (e.g. `1:11a`), returns the same verse with the next letter (e.g. `1:11b`). Otherwise returns undefined. */
export const incrementMarkVersesReferenceSuffix = (
  ref: string
): string | undefined => {
  const parsed = parseMarkVersesReference(ref);
  if (!parsed) return undefined;
  const endSuffix = parsed.end.verseLetterSuffix;
  if (!endSuffix) return undefined;
  const nextSuffix = nextMarkVersesLetterSuffix(endSuffix);
  if (!nextSuffix) return undefined;
  return `${parsed.end.chapter}:${parsed.end.verse}${nextSuffix}`;
};

export const parsePassageVerseKey = (
  ref: string,
  fallbackChapter = 0
): { chapter: number; verse: number } | undefined => {
  const parsed = parseMarkVersesReferencePart(
    normalizeRef(ref),
    fallbackChapter
  );
  if (!parsed) return undefined;
  return { chapter: parsed.chapter, verse: parsed.verse };
};

export const toPassageVerseKey = (chapter: number, verse: number) =>
  `${chapter}:${verse}`;

export const comparePassageVerses = (
  left: { chapter: number; verse: number },
  right: { chapter: number; verse: number }
) => {
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
};

export const passageRefsToVerseOptions = (
  refs: string[]
): PassageVerseOption[] =>
  refs
    .map((ref) => {
      const parsed = parsePassageVerseKey(ref);
      if (!parsed) return undefined;
      return {
        chapter: parsed.chapter,
        verse: parsed.verse,
        key: toPassageVerseKey(parsed.chapter, parsed.verse),
      } as PassageVerseOption;
    })
    .filter((option): option is PassageVerseOption => Boolean(option));

/** Ending verses from the current row's verse through the passage end (may cross chapters). */
export const getEndingVerseOptions = (
  passageRefs: string[],
  startChapter: number,
  startVerse: number
): PassageVerseOption[] => {
  const sequence = passageRefsToVerseOptions(passageRefs);
  if (sequence.length === 0) {
    return [
      {
        chapter: startChapter,
        verse: startVerse,
        key: toPassageVerseKey(startChapter, startVerse),
      },
    ];
  }

  const start = { chapter: startChapter, verse: startVerse };
  const startIndex = sequence.findIndex(
    (option) => option.chapter === start.chapter && option.verse === start.verse
  );
  if (startIndex < 0) {
    const nextIndex = sequence.findIndex(
      (option) => comparePassageVerses(start, option) <= 0
    );
    return nextIndex >= 0 ? sequence.slice(nextIndex) : sequence;
  }
  return sequence.slice(startIndex);
};

export const formatMarkVersesReference = ({
  startChapter,
  startVerse,
  startSuffix,
  endChapter,
  endVerse,
  endSuffix,
  splitVerse,
}: {
  startChapter: number;
  startVerse: number;
  startSuffix: string;
  endChapter: number;
  endVerse: number;
  endSuffix: string;
  splitVerse: boolean;
}) => {
  const startSuffixPart = splitVerse ? startSuffix : '';
  const endSuffixPart = splitVerse ? endSuffix : '';
  const sameVerse = startChapter === endChapter && startVerse === endVerse;

  if (!splitVerse) {
    if (sameVerse) return `${startChapter}:${startVerse}`;
    if (startChapter === endChapter) {
      return `${startChapter}:${startVerse}-${endVerse}`;
    }
    return `${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
  }

  if (sameVerse) {
    if (!startSuffixPart && !endSuffixPart) {
      return `${startChapter}:${startVerse}`;
    }
    // A span whose start and end land on the same subpart (e.g. 1:1a-1:1a) is a
    // single subpart, not a range — collapse it to `1:1a`.
    if (startSuffixPart === endSuffixPart) {
      return `${startChapter}:${startVerse}${startSuffixPart}`;
    }
    if (startSuffixPart && endSuffixPart) {
      return `${startChapter}:${startVerse}${startSuffixPart}-${endSuffixPart}`;
    }
    return `${startChapter}:${startVerse}${startSuffixPart}${endSuffixPart}`;
  }

  if (startChapter === endChapter) {
    return `${startChapter}:${startVerse}${startSuffixPart}-${endVerse}${endSuffixPart}`;
  }

  return `${startChapter}:${startVerse}${startSuffixPart}-${endChapter}:${endVerse}${endSuffixPart}`;
};

export interface EditReferenceComparable {
  splitVerse: boolean;
  startChapter: number;
  startVerse: number;
  startSuffix: string;
  endChapter: number;
  endVerse: number;
  endSuffix: string;
}

/** Normalize Edit Reference props the same way the dialog initializes draft state. */
export const normalizeEditReferenceDraft = <T extends EditReferenceComparable>(
  value: T
): T => {
  const splitVerse =
    MARK_VERSES_LETTER_SUFFIX.test(value.startSuffix) ||
    MARK_VERSES_LETTER_SUFFIX.test(value.endSuffix);
  return {
    ...value,
    splitVerse,
    startSuffix: splitVerse ? value.startSuffix : '',
    endSuffix: splitVerse ? value.endSuffix : '',
  };
};

/** Apply save-path normalization (strip suffixes when split is off). */
export const normalizeEditReferenceForSave = <
  T extends EditReferenceComparable,
>(
  value: T
): T =>
  value.splitVerse ? value : { ...value, startSuffix: '', endSuffix: '' };

export const editReferenceValuesEqual = (
  a: EditReferenceComparable,
  b: EditReferenceComparable
): boolean =>
  formatMarkVersesReference(normalizeEditReferenceForSave(a)) ===
  formatMarkVersesReference(normalizeEditReferenceForSave(b));
