/**
 * Decision logic for what happens to Mark Verses table numbering when a user
 * edits a reference
 *
 * "Re-numbering" here means the redistribution that
 * `redistributeTableTailAfterSave` performs in PassageDetailMarkVersesIsMobile:
 * pushing the passage refs after the edited range down/into the following rows.
 *
 * The caller passes the passage's `book`; chapter-verse lookups go through
 * `business/localParatext/getLastVerse`, the existing source of truth for "how
 * many verses are in a chapter" (the `eng-vrs` versification table). That is the
 * same data powering `refMatch`'s `endChapter === startChapter + 1` rule used to
 * validate cross-chapter refs. Unit tests exercise the chapter-boundary rules
 * (e.g. is `1:20 -> 2:1` consecutive?) with real book codes — `LUK` for a long
 * chapter 1 (80 verses), `REV` for a chapter 1 that ends at verse 20.
 */
import { refMatch } from './refMatch';
import { getLastVerse } from '../business/localParatext/getLastVerse';
import {
  nextMarkVersesLetterSuffix,
  parseMarkVersesReference,
  splitVerseSuffix,
} from './markVersesPassageVerses';
import { PassageD } from '@model/index';

export interface MarkVersesEditReferenceContext {
  /** The edited row's reference text after the edit (e.g. `1:6-7`). */
  newReference: string;
  /** All data-row references in order, as they exist *before* the edit. */
  tableReferences: string[];
  /**
   * Index of the edited row within `tableReferences`.
   * `tableReferences[rowIndex]`'s prior value is ignored — `newReference` is the
   * source of truth for the edited row.
   */
  rowIndex: number;
  passage: PassageD;
}

/** Well-formatted per the established table rules (delegates to refMatch). */
export const isWellFormedMarkVersesReference = (ref: string): boolean =>
  Boolean(ref) && refMatch(ref) !== null;

const verseInChapter = (
  book: string,
  chapter: number,
  verse: number
): boolean => {
  const last = getLastVerse(book, chapter);
  if (last === null || last === undefined) return false;
  return verse >= 1 && verse <= last;
};

/** Both endpoint verses exist in their chapters. */
export const isRefInVersification = (ref: string, book: string): boolean => {
  const parsed = parseMarkVersesReference(ref);
  if (!parsed) return false;
  return (
    verseInChapter(book, parsed.start.chapter, parsed.start.verse) &&
    verseInChapter(book, parsed.end.chapter, parsed.end.verse)
  );
};

/** Well-formatted AND in verses exist in chapters */
export const isValidMarkVersesReference = (
  ref: string,
  book: string
): boolean =>
  isWellFormedMarkVersesReference(ref) && isRefInVersification(ref, book);

/**
 * True when `nextRef`'s start consecutively follows `prevRef`'s end with no gap,
 * duplicate, or overlap. See markVersesEditReference.test.ts for the full spec.
 *
 * Rules (see markVersesEditReference.test.ts for the worked examples):
 * - Same verse: `nextRef` must continue the letter sequence, i.e. its start
 *   suffix is exactly the letter after `prevRef`'s end suffix (1:3a -> 1:3b,
 *   1:4a-c -> 1:4d). Both must carry suffixes.
 * - New verse: `prevRef`'s end verse must be "complete" first — a split verse is
 *   only complete once it has parts a AND b, so an end suffix of 'a' blocks
 *   moving on (1:1a -> 1:2 is rejected). The new verse must be the one
 *   immediately after, using `getLastVerse` to roll over chapters (1:20 -> 2:1
 *   only when chapter 1 ends at verse 20). A new split verse must begin at part
 *   a (1:1 -> 1:2b is rejected).
 */
export const markVersesReferenceConsecutivelyFollows = (
  prevRef: string,
  nextRef: string,
  book: string
): boolean => {
  const prev = parseMarkVersesReference(prevRef);
  const next = parseMarkVersesReference(nextRef);
  if (!prev || !next) return false;

  const prevEnd = prev.end;
  const nextStart = next.start;

  // Same-verse continuation: only valid as a letter-suffix sequence.
  if (
    nextStart.chapter === prevEnd.chapter &&
    nextStart.verse === prevEnd.verse
  ) {
    if (!prevEnd.verseLetterSuffix || !nextStart.verseLetterSuffix)
      return false;
    return (
      nextStart.verseLetterSuffix ===
      nextMarkVersesLetterSuffix(prevEnd.verseLetterSuffix)
    );
  }

  // Moving to a new verse requires the previous verse to be complete. A split
  // verse needs at least parts a and b, so an end suffix of exactly 'a' is
  // incomplete; '' (whole verse) or >= 'b' is complete.
  if (prevEnd.verseLetterSuffix === 'a') return false;

  // The verse immediately after prevEnd, rolling chapters via versification.
  const lastVerse = getLastVerse(book, prevEnd.chapter);
  if (lastVerse === null || lastVerse === undefined) return false;
  if (prevEnd.verse > lastVerse) return false;

  const expectedChapter =
    prevEnd.verse === lastVerse ? prevEnd.chapter + 1 : prevEnd.chapter;
  const expectedVerse = prevEnd.verse === lastVerse ? 1 : prevEnd.verse + 1;

  if (
    nextStart.chapter !== expectedChapter ||
    nextStart.verse !== expectedVerse
  ) {
    return false;
  }

  // A newly started split verse must begin at part a.
  if (nextStart.verseLetterSuffix && nextStart.verseLetterSuffix !== 'a')
    return false;

  return true;
};

/** Every adjacent pair of rows consecutively follows. */
export const isMarkVersesTableConsecutive = (
  refs: string[],
  book: string
): boolean => {
  for (let i = 1; i < refs.length; i += 1) {
    if (!markVersesReferenceConsecutivelyFollows(refs[i - 1], refs[i], book)) {
      return false;
    }
  }
  return true;
};

const isNonEmptyRef = (ref?: string): ref is string =>
  Boolean(ref && ref.trim());

/** Chapter-major ordering key for a verse position (suffix ignored). */
const verseOrderKey = (chapter: number, verse: number): number =>
  chapter * 1000 + verse;

const LETTER_SUFFIX_RANK: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
};
/** Rank of a missing suffix at the *start* of a span — the verse begins at part `a`. */
const VERSE_START_SUFFIX_RANK = LETTER_SUFFIX_RANK.a;
/** Rank of a missing suffix at the *end* of a span — after every letter part. */
const VERSE_END_SUFFIX_RANK = 6;

/**
 * Fine-grained ordering key that includes the letter subpart, so a subpart can
 * be compared against a bound within the same verse. `atVerseEnd` fixes how a
 * bare verse (no suffix) is ordered relative to its lettered parts: the start of
 * a span sits at part `a` (a verse begins at its first part), while the end of a
 * span runs through the whole verse, after part `e` (rank 6). A ref/bound that
 * names a specific part (`1:2b`) always uses that part's rank, regardless of
 * `atVerseEnd`.
 */
const verseSubpartKey = (
  chapter: number,
  verse: number,
  suffix: string,
  atVerseEnd: boolean
): number => {
  const suffixRank = suffix
    ? (LETTER_SUFFIX_RANK[suffix] ?? 0)
    : atVerseEnd
      ? VERSE_END_SUFFIX_RANK
      : VERSE_START_SUFFIX_RANK;
  return verseOrderKey(chapter, verse) * 10 + suffixRank;
};

/**
 * True when the whole span `ref` covers lies within `passage` — its start is at
 * or after the passage's start verse and its end is at or before the passage's
 * end verse. The passage is contiguous, so its two bounds (`startChapter`/
 * `startVerse` .. `endChapter`/`endVerse`) fully describe it.
 *
 * Comparison is subpart-aware: when a bound carries a letter (`2b`), a subpart
 * outside that part is outside the passage (`1:2a` is before `1:2b`). A bound
 * with no suffix means the whole verse — its start sits at part `a`, its end
 * after part `e`. Returns false when `ref` is unparseable or a passage bound is
 * missing.
 */
export const isMarkVersesReferenceInPassage = (
  ref: string,
  passage: PassageD
): boolean => {
  const parsed = parseMarkVersesReference(ref);
  const passageStartChapter = passage.attributes.startChapter;
  const passageEndChapter = passage.attributes.endChapter;
  // startVerse/endVerse may carry a letter suffix (e.g. `2b`); split it out so
  // the passage bounds are subpart-aware like the reference being tested.
  const passageStart = splitVerseSuffix(passage.attributes.startVerse);
  const passageEnd = splitVerseSuffix(passage.attributes.endVerse);
  if (
    !parsed ||
    !passageStartChapter ||
    !passageEndChapter ||
    !passageStart ||
    !passageEnd
  )
    return false;

  const lowerBound = verseSubpartKey(
    passageStartChapter,
    passageStart.verseNumber,
    passageStart.verseLetterSuffix,
    false
  );
  const upperBound = verseSubpartKey(
    passageEndChapter,
    passageEnd.verseNumber,
    passageEnd.verseLetterSuffix,
    true
  );
  const refStart = verseSubpartKey(
    parsed.start.chapter,
    parsed.start.verse,
    parsed.start.verseLetterSuffix,
    false
  );
  const refEnd = verseSubpartKey(
    parsed.end.chapter,
    parsed.end.verse,
    parsed.end.verseLetterSuffix,
    true
  );

  return refStart >= lowerBound && refEnd <= upperBound;
};

/**
 * When `newRef` does not consecutively follow `prevRef`, did its start jump
 * *past* the expected next verse (a forward gap — passage verses are skipped)?
 * Returning false means it sits at or before the expected next verse (an
 * overlap/duplicate) or fills an earlier gap (a backfill).
 */
const markVersesReferenceSkipsAhead = (
  prevRef: string,
  newRef: string,
  book: string
): boolean => {
  const prev = parseMarkVersesReference(prevRef);
  const next = parseMarkVersesReference(newRef);
  if (!prev || !next) return false;

  const prevEnd = prev.end;
  const lastVerse = getLastVerse(book, prevEnd.chapter);
  if (lastVerse === null || lastVerse === undefined) return false;
  if (prevEnd.verse > lastVerse) return false;

  const rollover = prevEnd.verse === lastVerse;
  const expectedChapter = rollover ? prevEnd.chapter + 1 : prevEnd.chapter;
  const expectedVerse = rollover ? 1 : prevEnd.verse + 1;

  return (
    verseOrderKey(next.start.chapter, next.start.verse) >
    verseOrderKey(expectedChapter, expectedVerse)
  );
};

/** Two references' verse spans intersect (suffixes ignored, verse granularity). */
const markVersesReferencesOverlap = (refA: string, refB: string): boolean => {
  const a = parseMarkVersesReference(refA);
  const b = parseMarkVersesReference(refB);
  if (!a || !b) return false;
  const aStart = verseOrderKey(a.start.chapter, a.start.verse);
  const aEnd = verseOrderKey(a.end.chapter, a.end.verse);
  const bStart = verseOrderKey(b.start.chapter, b.start.verse);
  const bEnd = verseOrderKey(b.end.chapter, b.end.verse);
  return aStart <= bEnd && bStart <= aEnd;
};

/**
 * Does `newRef` overlap any row *above* the edited one? Scans the whole prefix
 * (not just the immediately preceding row) so an unusual preceding row — empty,
 * multi-verse, or itself out of order — can't hide a clash with a row higher up.
 * Rows below are excluded: they get renumbered, so a clash there is not a
 * duplicate.
 */
const overlapsEarlierRow = (
  tableReferences: string[],
  editedRowIndex: number,
  newRef: string
): boolean => {
  for (let i = 0; i < editedRowIndex; i += 1) {
    const ref = tableReferences[i];
    if (isNonEmptyRef(ref) && markVersesReferencesOverlap(newRef, ref)) {
      return true;
    }
  }
  return false;
};

/**
 * Passage verse refs skipped when `newRef` starts past `prevRef`'s end — those
 * strictly after `prevRef`'s end and strictly before `newRef`'s start. Used to
 * fill the `missingReferences` tooltip's verse list. Returns [] when nothing is
 * skipped or the refs can't be parsed.
 */
export const markVersesSkippedPassageRefs = (
  prevRef: string,
  newRef: string,
  passageRefs: string[]
): string[] => {
  const prev = parseMarkVersesReference(prevRef);
  const next = parseMarkVersesReference(newRef);
  if (!prev || !next) return [];

  const afterKey = verseOrderKey(prev.end.chapter, prev.end.verse);
  const beforeKey = verseOrderKey(next.start.chapter, next.start.verse);
  return passageRefs.filter((ref) => {
    const parsed = parseMarkVersesReference(ref);
    if (!parsed) return false;
    const key = verseOrderKey(parsed.start.chapter, parsed.start.verse);
    return key > afterKey && key < beforeKey;
  });
};

/**
 * Why a row is flagged with a warning (drives the tooltip message). See
 * `evaluateMarkVersesReferenceStatus`, which is the single authority for this.
 * - `illFormatted`: fails refMatch.
 * - `outOfRange`: well-formed but the verse is outside the book / passage.
 * - `skipsAhead`: well-formed and in range, but its start jumps *past* the
 *   expected next verse, leaving passage verses skipped (a forward gap).
 * - `overlap`: well-formed and in range, but its verse span intersects a row
 *   above (duplicates / overlaps an already-assigned verse).
 *
 * A reference that neither skips ahead nor overlaps an earlier row — e.g. one
 * that backfills a previously skipped verse — is treated as valid, not flagged.
 */
export type MarkVersesWarningReason =
  | 'illFormatted'
  | 'outOfRange'
  | 'skipsAhead'
  | 'overlap';

/**
 * Per-row warning evaluation: the single authority for whether a reference cell
 * should be flagged and why, independent of any edit. Applied both when
 * hydrating the table on load and after an edit, so a freshly-loaded table
 * flags the same problems an edit would.
 *
 * `tableReferences` is every data-row reference in order; `rowIndex` is this
 * reference's position within it. Ladder (first match wins): illFormatted ->
 * outOfRange -> overlap (intersects a row above) -> skipsAhead (start jumps past
 * the expected next verse). A reference that consecutively follows the row
 * above, or merely backfills an earlier gap, yields no reason.
 */
export const evaluateMarkVersesReferenceStatus = (
  ctx: MarkVersesEditReferenceContext
): { reason?: MarkVersesWarningReason } => {
  const { newReference, tableReferences, rowIndex, passage } = ctx;
  if (!isNonEmptyRef(newReference)) return {};
  if (
    !isValidMarkVersesReference(newReference, passage.attributes.book) ||
    !isRefInVersification(newReference, passage.attributes.book)
  ) {
    return { reason: 'illFormatted' };
  }
  if (!isMarkVersesReferenceInPassage(newReference, passage)) {
    return { reason: 'outOfRange' };
  }
  if (overlapsEarlierRow(tableReferences, rowIndex, newReference)) {
    return { reason: 'overlap' };
  }
  const precedingReference =
    rowIndex > 0 ? tableReferences[rowIndex - 1] : undefined;
  if (
    isNonEmptyRef(precedingReference) &&
    markVersesReferenceSkipsAhead(
      precedingReference,
      newReference,
      passage.attributes.book
    )
  ) {
    return { reason: 'skipsAhead' };
  }
  return {};
};

/** True when `ref`'s start sits exactly at the passage's start verse. */
export const markVersesReferenceStartsPassage = (
  ref: string,
  passage: PassageD
): boolean => {
  const parsed = parseMarkVersesReference(ref);
  const { startChapter, startVerse } = passage.attributes;
  if (!parsed || startChapter === undefined || startVerse === undefined) {
    return false;
  }
  // The start must land on the *beginning* of the passage's start verse: only a
  // letterless start or part `a` begins the verse; a later subpart (`b`, `c`, …)
  // starts mid-verse and does not sit on the passage start.
  const suffix = parsed.start.verseLetterSuffix;
  if (suffix && suffix !== 'a') {
    return false;
  }
  return (
    verseOrderKey(parsed.start.chapter, parsed.start.verse) ===
    verseOrderKey(startChapter, startVerse)
  );
};

/**
 * Decide whether an Edit Reference save should re-number the tail (`renumber`)
 * or leave the table alone (`none`). Row flagging is handled separately by
 * `evaluateMarkVersesReferenceStatus`.
 **/
export const shouldAutoRenumberAfterEdit = (
  ctx: MarkVersesEditReferenceContext
): boolean => {
  const { newReference, tableReferences, rowIndex, passage } = ctx;

  const editedTable = tableReferences.map((ref, index) =>
    index === rowIndex ? newReference : ref
  );

  // Rule 1: any bad references anywhere in the edited table block
  // re-numbering.
  const anyBadReferences = editedTable.some(
    (ref) =>
      isNonEmptyRef(ref) &&
      (!isValidMarkVersesReference(ref, passage.attributes.book) ||
        !isMarkVersesReferenceInPassage(ref, passage))
  );
  if (anyBadReferences) return false;

  // Rule 2: if the new passage is not the next consecutive passage
  // don't re-number. The first data row must be the start of the passage to allow re-numbering
  const precedingReference = editedTable
    .slice(0, rowIndex)
    .filter(isNonEmptyRef)
    .pop();
  if (isNonEmptyRef(precedingReference)) {
    // A data row above the edit: the new start must consecutively follow it.
    if (
      !markVersesReferenceConsecutivelyFollows(
        precedingReference,
        newReference,
        passage.attributes.book
      )
    ) {
      return false;
    }
  } else if (!markVersesReferenceStartsPassage(newReference, passage)) {
    return false;
  }

  // Rule 3: re-number only when both halves around the edited row are already
  // internally sequential.
  const above = editedTable.slice(0, rowIndex).filter(isNonEmptyRef);
  const below = editedTable.slice(rowIndex + 1).filter(isNonEmptyRef);
  if (
    isMarkVersesTableConsecutive(above, passage.attributes.book) &&
    isMarkVersesTableConsecutive(below, passage.attributes.book)
  ) {
    return true;
  }

  return false;
};
