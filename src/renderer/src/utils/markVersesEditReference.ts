/**
 * Decision logic for what happens to Mark Verses table numbering when a user
 * edits a reference
 *
 * "Re-numbering" here means the redistribution that
 * `redistributeTableTailAfterSave` performs in PassageDetailMarkVersesIsMobile:
 * pushing the passage refs after the edited range down/into the following rows.
 *
 * This module is intentionally pure and book-agnostic: the caller injects a
 * `getLastVerse(chapter)` lookup (bound to the passage's book) so the
 * chapter-boundary rules (e.g. is `1:20 -> 2:1` consecutive?) can be unit
 * tested. That lookup mirrors `business/localParatext/getLastVerse`, which is
 * the existing source of truth for "how many verses are in a chapter" (the
 * `eng-vrs` versification table). The same data already powers `refMatch`'s
 * `endChapter === startChapter + 1` rule used to validate cross-chapter refs.
 */
import { refMatch } from './refMatch';
import {
  nextMarkVersesLetterSuffix,
  parseMarkVersesReference,
} from './markVersesPassageVerses';

/** Last (highest) verse number for a chapter, or null when the chapter is out of range. */
export type GetLastVerse = (chapter: number) => number | null;

/**
 * What to do with the surrounding table after a reference edit.
 * - `renumber`: run the existing redistribute-tail logic.
 * - `none`: leave numbering untouched.
 *
 * This decides numbering only. Whether a row is *flagged* with a warning is
 * owned by `evaluateMarkVersesReferenceStatus`,
 * applied per row both on load and after an edit, so a freshly-loaded table
 * flags the same problems an edit would.
 */
export type MarkVersesEditReferenceAction = 'renumber' | 'none';

export interface MarkVersesEditReferenceContext {
  /** The edited row's reference text before the edit (e.g. `1:3-5`). */
  previousReference: string;
  /** The edited row's reference text after the edit (e.g. `1:6-7`). */
  newReference: string;
  /**
   * Reference of the row immediately above the edited row — its "end number
   * before it". `undefined` when editing the first data row.
   */
  precedingReference?: string;
  /** All data-row references in order, as they exist *before* the edit. */
  tableReferences: string[];
  /** Index of the edited row within `tableReferences`. */
  rowIndex: number;
  /** Versification lookup bound to the passage's book. */
  getLastVerse: GetLastVerse;
}

/** Well-formatted per the established table rules (delegates to refMatch). */
export const isWellFormedMarkVersesReference = (ref: string): boolean =>
  Boolean(ref) && refMatch(ref) !== null;

const partInRange = (
  chapter: number,
  verse: number,
  getLastVerse: GetLastVerse
): boolean => {
  const last = getLastVerse(chapter);
  if (last === null || last === undefined) return false;
  return verse >= 1 && verse <= last;
};

/** Both endpoints exist in the book's versification. */
// TODO this the wrong check?
export const isMarkVersesReferenceInRange = (
  ref: string,
  getLastVerse: GetLastVerse
): boolean => {
  const parsed = parseMarkVersesReference(ref);
  if (!parsed) return false;
  return (
    partInRange(parsed.start.chapter, parsed.start.verse, getLastVerse) &&
    partInRange(parsed.end.chapter, parsed.end.verse, getLastVerse)
  );
};

/** Well-formatted AND in range. */
export const isValidMarkVersesReference = (
  ref: string,
  getLastVerse: GetLastVerse
): boolean =>
  isWellFormedMarkVersesReference(ref) &&
  isMarkVersesReferenceInRange(ref, getLastVerse);

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
  getLastVerse: GetLastVerse
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
    if (!prevEnd.suffix || !nextStart.suffix) return false;
    return nextStart.suffix === nextMarkVersesLetterSuffix(prevEnd.suffix);
  }

  // Moving to a new verse requires the previous verse to be complete. A split
  // verse needs at least parts a and b, so an end suffix of exactly 'a' is
  // incomplete; '' (whole verse) or >= 'b' is complete.
  if (prevEnd.suffix === 'a') return false;

  // The verse immediately after prevEnd, rolling chapters via versification.
  const lastVerse = getLastVerse(prevEnd.chapter);
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
  if (nextStart.suffix && nextStart.suffix !== 'a') return false;

  return true;
};

/** Every adjacent pair of rows consecutively follows. */
export const isMarkVersesTableConsecutive = (
  refs: string[],
  getLastVerse: GetLastVerse
): boolean => {
  for (let i = 1; i < refs.length; i += 1) {
    if (
      !markVersesReferenceConsecutivelyFollows(
        refs[i - 1],
        refs[i],
        getLastVerse
      )
    ) {
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

/**
 * When `newRef` does not consecutively follow `prevRef`, did its start jump
 * *past* the expected next verse (a forward gap — passage verses are skipped)?
 * Returning false means it sits at or before the expected next verse (an
 * overlap/duplicate) or fills an earlier gap (a backfill).
 */
const markVersesReferenceSkipsAhead = (
  prevRef: string,
  newRef: string,
  getLastVerse: GetLastVerse
): boolean => {
  const prev = parseMarkVersesReference(prevRef);
  const next = parseMarkVersesReference(newRef);
  if (!prev || !next) return false;

  const prevEnd = prev.end;
  const lastVerse = getLastVerse(prevEnd.chapter);
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
  reference: string,
  tableReferences: string[],
  rowIndex: number,
  getLastVerse: GetLastVerse
): { reason?: MarkVersesWarningReason } => {
  if (!isNonEmptyRef(reference)) return {};
  if (!isWellFormedMarkVersesReference(reference)) {
    return { reason: 'illFormatted' };
  }
  if (!isMarkVersesReferenceInRange(reference, getLastVerse)) {
    return { reason: 'outOfRange' };
  }
  if (overlapsEarlierRow(tableReferences, rowIndex, reference)) {
    return { reason: 'overlap' };
  }
  const precedingReference =
    rowIndex > 0 ? tableReferences[rowIndex - 1] : undefined;
  if (
    isNonEmptyRef(precedingReference) &&
    markVersesReferenceSkipsAhead(precedingReference, reference, getLastVerse)
  ) {
    return { reason: 'skipsAhead' };
  }
  return {};
};

export interface MarkVersesEditReferenceResult {
  action: MarkVersesEditReferenceAction;
}

/**
 * Evaluate an Edit Reference save: the numbering action to take (`renumber` or
 * `none`). Row flagging is handled separately by
 * `evaluateMarkVersesReferenceStatus`. Branches mirror the spec in
 * markVersesEditReference.test.ts.
 */
export const evaluateMarkVersesEditReference = (
  ctx: MarkVersesEditReferenceContext
): MarkVersesEditReferenceResult => {
  const {
    newReference,
    precedingReference,
    tableReferences,
    rowIndex,
    getLastVerse,
  } = ctx;

  // Branch 1: if the pre-existing table already has an ill-formatted or
  // out-of-range reference, never re-number — we can't reason about it.
  const preExistingInvalid = tableReferences.some(
    (ref) =>
      isNonEmptyRef(ref) && !isValidMarkVersesReference(ref, getLastVerse)
  );
  if (preExistingInvalid) return { action: 'none' };

  // Branch 2: the result itself is ill-formatted or out of range — leave
  // numbering untouched (the row gets flagged by the per-row status pass).
  if (!isValidMarkVersesReference(newReference, getLastVerse)) {
    return { action: 'none' };
  }

  const wasConsecutive = isMarkVersesTableConsecutive(
    tableReferences.filter(isNonEmptyRef),
    getLastVerse
  );

  if (wasConsecutive) {
    // Branch 3: clean table + valid result. Re-number when the new start still
    // consecutively follows the row above (the dropdown-style edits that keep
    // the start fixed always do). The first data row has nothing above it.
    if (!isNonEmptyRef(precedingReference)) return { action: 'renumber' };
    if (
      markVersesReferenceConsecutivelyFollows(
        precedingReference,
        newReference,
        getLastVerse
      )
    ) {
      return { action: 'renumber' };
    }
    // Anything else (overlaps a row above, skips ahead, or backfills an earlier
    // gap) leaves numbering alone; the per-row status pass decides whether to
    // flag it and why.
    return { action: 'none' };
  }

  // Branch 4: the table already had a duplicate / gap / non-consecutive
  // situation. Re-number only if this edit heals everything from the top down
  // through the edited row, leaving at most an overlap with the row below that
  // was introduced by the edited row's new end number (which re-numbering the
  // tail will absorb). Otherwise leave numbering alone.
  //
  // OPEN QUESTION (per Noel): is there an edge case here where we would NOT want
  // to re-number? Candidate: a pre-existing break that lives *below* the edited
  // row (not caused by this edit) — re-numbering the tail would then silently
  // shift rows the user never touched. That case is intentionally not handled
  // yet; see the matching it.todo in the test file.
  const editedTable = tableReferences.map((ref, index) =>
    index === rowIndex ? newReference : ref
  );
  const throughEdited = editedTable
    .slice(0, rowIndex + 1)
    .filter(isNonEmptyRef);
  const upperHealed = isMarkVersesTableConsecutive(throughEdited, getLastVerse);
  const hasTail = editedTable.slice(rowIndex + 1).some(isNonEmptyRef);
  if (upperHealed && hasTail) return { action: 'renumber' };

  return { action: 'none' };
};

/**
 * Decide whether an Edit Reference save should re-number the tail, flag the
 * edited row, or leave the table alone. See `evaluateMarkVersesEditReference`
 * for the reason behind a `warn`.
 */
export const decideMarkVersesEditReferenceAction = (
  ctx: MarkVersesEditReferenceContext
): MarkVersesEditReferenceAction => evaluateMarkVersesEditReference(ctx).action;
