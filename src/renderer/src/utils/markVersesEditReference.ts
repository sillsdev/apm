/**
 * Decision logic for what happens to Mark Verses table numbering when a user
 * edits a reference
 */
import { getLastVerse } from '../business/localParatext/getLastVerse';
import {
  incrementMarkVersesReferenceSuffix,
  nextMarkVersesLetterSuffix,
  parseMarkVersesReference,
  splitVerseSuffix,
  type ParsedMarkVersesReferencePart,
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

/**
 * Well-formatted per the established table rules: the text parses into a
 * chapter:verse start (and optional end), and the range does not run backwards.
 *
 * Unlike `refMatch`, this accepts ranges spanning any number of chapters
 * (e.g. `1:1-4:10`), not just an adjacent chapter boundary — a Mark Verses row
 * may legitimately cover several chapters. `parseMarkVersesReference` falls back
 * to chapter 0 when the text names no chapter (a bare `1`), so a real reference
 * must have a chapter >= 1 on both ends. A range whose end precedes its start
 * (`1:3-1:1`, `4:10-1:1`, `3:5-3:2`) is ill-formatted.
 */
export const isWellFormedMarkVersesReference = (ref: string): boolean => {
  const parsed = parseMarkVersesReference(ref);
  if (!parsed) return false;

  const { start, end } = parsed;
  if (start.chapter < 1 || end.chapter < 1) return false;

  // End must be at or after start (chapter, then verse, then letter subpart).
  if (end.chapter !== start.chapter) return end.chapter > start.chapter;
  if (end.verse !== start.verse) return end.verse > start.verse;
  // Same verse: a lettered end must not precede a lettered start (a bare end
  // means the whole verse, which never runs backwards).
  return !(
    end.verseLetterSuffix &&
    start.verseLetterSuffix &&
    end.verseLetterSuffix < start.verseLetterSuffix
  );
};

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
 * duplicate, or overlap.
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

/**
 * The reference that should lead the row *after* an edited reference when the
 * table auto-renumbers, or `undefined` when the following row simply resumes at
 * the next passage verse.
 *
 * Everything hinges on where the reference *ends* inside its end verse:
 * - No end suffix (a whole verse, `1:1`, or a plain range `1:1-3`): nothing to
 *   continue, so the tail resumes at the next passage verse.
 * - Ends at part `a` (`1:1a`, `1:1b-1:2a`): we assume a verse will never end at part `a`
 *   (because otherwise why would it be given a letter subpart at all)
 *   so the next row must continue the end verse with part `b` (`1:1b`, `1:2b`).
 * - Ends at part `b` or later: the answer depends on whether part `a` of the end
 *   verse is *included* in the range.
 *   - Included — the range covers the end verse from its start (a single verse
 *     beginning at `a`, or a range spanning in from an earlier verse). The user
 *     deliberately stopped short of the whole verse (they'd have written `1:1`
 *     otherwise), implying a further part exists, so continue with the next
 *     letter (`1:1a-b` -> `1:1c`, `1:1a-d` -> `1:1e`, `1:1-1:2b` -> `1:2c`).
 *   - Excluded — a single-verse range beginning at part `b`+ (`1:1b`, `1:1b-c`,
 *     `1:1c-d`). The letter is just there to drop part `a`; verses rarely have
 *     parts past `b`, so treat the verse as done and move to the next verse.
 *
 * - `1:1b-1:2b` is the case I'm least sure about. The user may have been
 *     entering the verse in the Edit Reference dialog, and then checked "Split
 *     verse" in order to enter the 1:1b, but  then we give them letter slots on
 *     both the reference start and the reference end, so they may have seen the
 *     entered 2b instead of 2 only because they saw the letter slot and 2b very
 *     well may be the end of verse 2. But I am probably overthinking this and
 *     thought it not worth further complicating the code for such a corner
 *     corner case.
 */
export const markVersesRenumberLeadingRef = (
  newReference: string
): string | undefined => {
  const parsed = parseMarkVersesReference(newReference);
  if (!parsed) return undefined;

  const endSuffix = parsed.end.verseLetterSuffix;
  if (!endSuffix) return undefined;

  // Where the end verse's coverage begins: at part `a` when the range spans in
  // from an earlier verse, otherwise at the range's own start suffix.
  const sameVerse =
    parsed.start.chapter === parsed.end.chapter &&
    parsed.start.verse === parsed.end.verse;
  const endVerseCoverageStartsAtA =
    !sameVerse ||
    !parsed.start.verseLetterSuffix ||
    parsed.start.verseLetterSuffix === 'a';

  // A `b`+ end that excludes part `a` (a single verse starting mid-way) just
  // drops the leading part; move on to the next verse. Every other case
  // continues the end verse with the next letter (which
  // `incrementMarkVersesReferenceSuffix` supplies, or `undefined` past `e`).
  if (endSuffix !== 'a' && !endVerseCoverageStartsAtA) return undefined;

  return incrementMarkVersesReferenceSuffix(newReference);
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
/** Letter subparts indexed by rank-1 (`LETTER_SUFFIXES[0]` === `'a'`). */
const LETTER_SUFFIXES = ['a', 'b', 'c', 'd', 'e'];
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
 * *past* where coverage should resume (a forward gap — passage verses or
 * subparts are skipped)? Returning false means it sits at or before that point
 * (an overlap/duplicate) or fills an earlier gap (a backfill).
 * This function assumes ref is in passage and is well-formed
 */
const markVersesReferenceSkipsAhead = (
  prevRef: string | undefined,
  newRef: string,
  passage: PassageD
): boolean => {
  if (!prevRef) return !markVersesReferenceStartsPassage(newRef, passage);
  const prev = parseMarkVersesReference(prevRef);
  const next = parseMarkVersesReference(newRef);
  if (!prev || !next) return false;
  // If this is the first row and it doesn't line up with the start of the passage, it is skipping ahead (assuming it is not out of passage)

  const prevEnd = prev.end;
  const lastVerse = getLastVerse(passage.attributes.book, prevEnd.chapter);
  if (lastVerse === null || lastVerse === undefined) return false;
  if (prevEnd.verse > lastVerse) return false;

  // Where coverage should resume. A split verse ending at part `a` is
  // incomplete (a verse never ends at `a`), so the next expected position is
  // part `b` of the *same* verse. Any other end — a whole verse, or a complete
  // split ending at `b`+ — finishes the verse, so the next whole verse
  // (beginning at part `a`) is expected.
  const expectedKey =
    prevEnd.verseLetterSuffix === 'a'
      ? verseSubpartKey(prevEnd.chapter, prevEnd.verse, 'b', false)
      : (() => {
          const rollover = prevEnd.verse === lastVerse;
          const expectedChapter = rollover
            ? prevEnd.chapter + 1
            : prevEnd.chapter;
          const expectedVerse = rollover ? 1 : prevEnd.verse + 1;
          return verseSubpartKey(expectedChapter, expectedVerse, '', false);
        })();

  const nextStartKey = verseSubpartKey(
    next.start.chapter,
    next.start.verse,
    next.start.verseLetterSuffix,
    false
  );

  return nextStartKey > expectedKey;
};

/**
 * Two references' spans intersect, compared at subpart granularity so distinct
 * lettered parts of the same verse do not clash. A span's start is ordered at
 * the beginning of its start verse (part `a` when letterless) and its end after
 * the whole of its end verse (past part `e` when letterless), so `1:2a` and
 * `1:2b` do not overlap while `1:2` (the whole verse) overlaps either.
 */
const markVersesReferencesOverlap = (refA: string, refB: string): boolean => {
  const a = parseMarkVersesReference(refA);
  const b = parseMarkVersesReference(refB);
  if (!a || !b) return false;
  const aStart = verseSubpartKey(
    a.start.chapter,
    a.start.verse,
    a.start.verseLetterSuffix,
    false
  );
  const aEnd = verseSubpartKey(
    a.end.chapter,
    a.end.verse,
    a.end.verseLetterSuffix,
    true
  );
  const bStart = verseSubpartKey(
    b.start.chapter,
    b.start.verse,
    b.start.verseLetterSuffix,
    false
  );
  const bEnd = verseSubpartKey(
    b.end.chapter,
    b.end.verse,
    b.end.verseLetterSuffix,
    true
  );
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
 * fill the `missingReferences` tooltip's verse list.
 *
 * With no preceding row (`prevRef` empty/undefined), `newRef` is expected to sit
 * at the passage start, so every passage verse before `newRef`'s start counts as
 * skipped — the lower bound drops to before the passage. Returns [] when nothing
 * is skipped, `newRef` can't be parsed, or a non-empty `prevRef` can't be parsed.
 */
export const markVersesSkippedPassageRefs = (
  prevRef: string | undefined,
  newRef: string,
  passageRefs: string[]
): string[] => {
  const next = parseMarkVersesReference(newRef);
  if (!next) return [];

  // Exclusive lower bound. Without a preceding row the skipped range opens at
  // the start of the passage, so -Infinity keeps every ref before `newRef`.
  let afterKey = Number.NEGATIVE_INFINITY;
  let prevEnd: ParsedMarkVersesReferencePart | undefined;
  if (isNonEmptyRef(prevRef)) {
    const prev = parseMarkVersesReference(prevRef);
    if (!prev) return [];
    prevEnd = prev.end;
    afterKey = verseOrderKey(prev.end.chapter, prev.end.verse);
  }

  // Whole passage verses lying strictly between the prior end verse and the new
  // start verse. `newRef`'s own start verse is excluded here — any leading
  // subparts it skips are handled below.
  const beforeKey = verseOrderKey(next.start.chapter, next.start.verse);
  const skipped = passageRefs.filter((ref) => {
    const parsed = parseMarkVersesReference(ref);
    if (!parsed) return false;
    const key = verseOrderKey(parsed.start.chapter, parsed.start.verse);
    return key > afterKey && key < beforeKey;
  });

  // Subpart skips: when `newRef` starts mid-verse (part `b`+), the leading
  // subparts of that verse are skipped, e.g. `1:1` -> `1:2b` skips `1:2a`. If
  // the prior row already covered earlier subparts of this same verse, start
  // just after where it left off (`1:2a` -> `1:2c` skips only `1:2b`).
  const startSuffix = next.start.verseLetterSuffix;
  if (startSuffix && startSuffix !== 'a') {
    let firstMissingRank = VERSE_START_SUFFIX_RANK;
    if (
      prevEnd &&
      prevEnd.chapter === next.start.chapter &&
      prevEnd.verse === next.start.verse &&
      prevEnd.verseLetterSuffix
    ) {
      firstMissingRank =
        (LETTER_SUFFIX_RANK[prevEnd.verseLetterSuffix] ?? 0) + 1;
    }
    const startRank = LETTER_SUFFIX_RANK[startSuffix] ?? 0;
    for (let rank = firstMissingRank; rank < startRank; rank += 1) {
      const letter = LETTER_SUFFIXES[rank - 1];
      if (letter) {
        skipped.push(`${next.start.chapter}:${next.start.verse}${letter}`);
      }
    }
  }

  return skipped;
};

/**
 * Why a row is flagged with a warning (drives the tooltip message). See
 * `evaluateMarkVersesReferenceStatus`, which is the single authority for this.
 * String-valued so the serialized form stays human-readable, mirroring
 * `RefStatus`.
 *
 * A reference that neither skips ahead nor overlaps an earlier row — e.g. one
 * that backfills a previously skipped verse — is treated as valid, not flagged.
 */
export enum MarkVersesWarningReason {
  /** Fails `refMatch`. */
  IllFormatted = 'illFormatted',
  /** Well-formed but the verse is outside the book / passage. */
  OutOfRange = 'outOfRange',
  /**
   * Well-formed and in range, but its start jumps *past* the expected next
   * verse, leaving passage verses skipped (a forward gap).
   */
  SkipsAhead = 'skipsAhead',
  /**
   * Well-formed and in range, but its verse span intersects a row above
   * (duplicates / overlaps an already-assigned verse).
   */
  Overlap = 'overlap',
}

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
  if (!isValidMarkVersesReference(newReference, passage.attributes.book)) {
    return { reason: MarkVersesWarningReason.IllFormatted };
  }
  if (!isMarkVersesReferenceInPassage(newReference, passage)) {
    return { reason: MarkVersesWarningReason.OutOfRange };
  }
  if (overlapsEarlierRow(tableReferences, rowIndex, newReference)) {
    return { reason: MarkVersesWarningReason.Overlap };
  }
  const precedingReference =
    rowIndex > 0 ? tableReferences[rowIndex - 1] : undefined;
  if (
    markVersesReferenceSkipsAhead(precedingReference, newReference, passage)
  ) {
    return { reason: MarkVersesWarningReason.SkipsAhead };
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
