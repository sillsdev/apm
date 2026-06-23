import { refMatch } from './refMatch';

export interface MarkVersesValidationStrings {
  badReferences: string;
  noSegments: string;
  missingReferences: string;
  outsideReferences: string;
  noReferences: string;
  btNotUpdated: string;
}

export interface MarkVersesValidationRow {
  limits: string;
  ref: string;
}

export interface MarkVersesValidationInput {
  rows: MarkVersesValidationRow[];
  /** Verse references expanded from table cells (see Mark Verses collectRefs). */
  expandedRefs: string[];
  passageRefs: string[];
  hasBtRecordings: boolean;
  strings: MarkVersesValidationStrings;
}

/**
 * Sub-verse coverage model.
 *
 * A verse may be split into consecutive parts a, b, c, … (we assume every verse
 * has at least parts a and b). References therefore name either a whole verse
 * (`1:2`) or a span of parts within one verse (`1:2a`, `1:2a-c`, `3:4b-c`).
 *
 * Part letters are represented as zero-based indices (a=0, b=1, …).
 */
const PART_LETTERS = ['a', 'b', 'c', 'd', 'e'];
const ALL_PART_INDEXES = PART_LETTERS.map((_, i) => i);
const B_INDEX = 1; // verses need at least parts a and b to count as covered

const letterIndex = (letter: string) =>
  PART_LETTERS.indexOf(letter.toLowerCase());

const verseKeyOf = (ref: string): string | null => {
  const m = /^\s*(\d+)[:.](\d+)/.exec(ref);
  return m ? `${parseInt(m[1], 10)}:${parseInt(m[2], 10)}` : null;
};

/** A reference that resolves to a single verse, possibly a span of its parts. */
interface ParsedMarkedRef {
  verseKey: string;
  /** Whole verse (no part letters) — covers every part. */
  whole: boolean;
  /** Inclusive part-index span (ignored when `whole`). */
  loPart: number;
  hiPart: number;
  original: string;
}

const parseMarkedRef = (ref: string): ParsedMarkedRef | null => {
  const m = /^\s*(\d+)[:.](\d+)([a-e])?(?:-([a-e]))?\s*$/i.exec(ref);
  if (!m) return null;
  const verseKey = `${parseInt(m[1], 10)}:${parseInt(m[2], 10)}`;
  const start = m[3];
  const end = m[4];
  if (!start && !end) {
    return { verseKey, whole: true, loPart: 0, hiPart: 0, original: ref };
  }
  const loPart = start ? letterIndex(start) : 0;
  const hiPart = end ? letterIndex(end) : loPart;
  return { verseKey, whole: false, loPart, hiPart, original: ref };
};

const partsOf = (ref: ParsedMarkedRef): number[] =>
  ref.whole
    ? ALL_PART_INDEXES
    : ALL_PART_INDEXES.filter((i) => i >= ref.loPart && i <= ref.hiPart);

/** The parts of a single passage verse that the markup is expected to cover. */
interface ExpectedVerse {
  /** Original passage ref (e.g. `1:2` or `1:4a`) — used in messages. */
  ref: string;
  /** Whole verse expected (no part boundary). */
  whole: boolean;
  /** Inclusive lower part bound. */
  loPart: number;
  /** Inclusive upper part bound, or null when open-ended (to the verse end). */
  hiPart: number | null;
}

const parsePassageRef = (ref: string) => {
  const m = /^\s*(\d+)[:.](\d+)([a-e])?\s*$/i.exec(ref);
  if (!m) return null;
  return {
    verseKey: `${parseInt(m[1], 10)}:${parseInt(m[2], 10)}`,
    suffix: m[3] ? m[3].toLowerCase() : '',
    original: ref.trim(),
  };
};

/**
 * Build the expected-coverage map from the passage's verse list. A passage is a
 * contiguous range, so only its first/last entries can carry a part boundary:
 * a leading suffix (`1:2b-…`) starts part-way through the verse, a trailing
 * suffix (`…-1:4a`) stops part-way through it.
 */
const buildExpectedVerses = (
  passageRefs: string[]
): Map<string, ExpectedVerse> => {
  const parsed = passageRefs.map(parsePassageRef);
  const map = new Map<string, ExpectedVerse>();
  parsed.forEach((p, idx) => {
    if (!p) return;
    if (!p.suffix) {
      map.set(p.verseKey, {
        ref: p.original,
        whole: true,
        loPart: 0,
        hiPart: null,
      });
      return;
    }
    const part = letterIndex(p.suffix);
    const isFirst = idx === 0;
    const isLast = idx === parsed.length - 1;
    if (isFirst && !isLast) {
      // Start boundary: from this part through the end of the verse.
      map.set(p.verseKey, {
        ref: p.original,
        whole: false,
        loPart: part,
        hiPart: null,
      });
    } else if (isLast && !isFirst) {
      // End boundary: from the start of the verse through this part.
      map.set(p.verseKey, {
        ref: p.original,
        whole: false,
        loPart: 0,
        hiPart: part,
      });
    } else {
      // Lone partial verse: exactly this part.
      map.set(p.verseKey, {
        ref: p.original,
        whole: false,
        loPart: part,
        hiPart: part,
      });
    }
  });
  return map;
};

/** True when the marked parts extend outside the expected part window. */
const overshootsExpected = (
  marked: ParsedMarkedRef,
  expected: ExpectedVerse
): boolean => {
  if (marked.whole) {
    // A whole verse covers every part, so it overshoots any bounded expectation.
    return expected.loPart > 0 || expected.hiPart !== null;
  }
  return (
    marked.loPart < expected.loPart ||
    (expected.hiPart !== null && marked.hiPart > expected.hiPart)
  );
};

/**
 * A verse is covered when its parts are present as a contiguous run from the
 * expected start, with no internal gap and nothing left dangling past the run.
 * Whole verses additionally require at least parts a and b.
 */
const isVerseCovered = (
  expected: ExpectedVerse,
  marked: ParsedMarkedRef[]
): boolean => {
  if (marked.some((m) => m.whole)) return true;

  const present = new Set<number>();
  marked.forEach((m) => partsOf(m).forEach((i) => present.add(i)));
  if (present.size === 0) return false;

  let runEnd = expected.loPart - 1;
  for (
    let i = expected.loPart;
    i < ALL_PART_INDEXES.length && present.has(i);
    i++
  ) {
    runEnd = i;
  }

  if (expected.hiPart !== null) {
    // Bounded: every expected part must be present (strays past hi are overshoot).
    return runEnd >= expected.hiPart;
  }
  // Open-ended: contiguous from the start, no dangling part past the run, and a
  // whole verse needs at least a+b.
  const minRunEnd = expected.whole ? B_INDEX : expected.loPart;
  const maxPresent = Math.max(...present);
  return runEnd >= minRunEnd && maxPresent === runEnd;
};

interface RefAnalysis {
  /** Bad syntax or repeated/overlapping parts — a hard error. */
  hasBadReference: boolean;
  /** Refs that fall outside the passage or past a part boundary. */
  outsideRefs: string[];
  /** Passage refs whose parts are not fully covered. */
  missingRefs: string[];
}

const analyzeRefs = (
  expandedRefs: string[],
  passageRefs: string[]
): RefAnalysis => {
  const expected = buildExpectedVerses(passageRefs);
  const syntaxOk = expandedRefs.every((ref) => refMatch(ref));

  const byVerse = new Map<string, ParsedMarkedRef[]>();
  const outsideRefs: string[] = [];
  let hasOverlap = false;

  expandedRefs.forEach((ref) => {
    const parsed = parseMarkedRef(ref);
    if (!parsed) {
      // Unexpected form (e.g. an unexpanded multi-verse range): fall back to
      // exact passage membership.
      if (refMatch(ref) && !passageRefs.includes(ref)) outsideRefs.push(ref);
      return;
    }
    const list = byVerse.get(parsed.verseKey) ?? [];
    list.push(parsed);
    byVerse.set(parsed.verseKey, list);
  });

  byVerse.forEach((refs, verseKey) => {
    // Overlap: a part covered by more than one reference.
    const coverage = ALL_PART_INDEXES.map(() => 0);
    refs.forEach((r) => partsOf(r).forEach((i) => (coverage[i] += 1)));
    if (coverage.some((count) => count > 1)) hasOverlap = true;

    const exp = expected.get(verseKey);
    if (!exp) {
      refs.forEach((r) => outsideRefs.push(r.original));
      return;
    }
    refs.forEach((r) => {
      if (overshootsExpected(r, exp)) outsideRefs.push(r.original);
    });
  });

  const missingRefs: string[] = [];
  expected.forEach((exp, verseKey) => {
    if (!isVerseCovered(exp, byVerse.get(verseKey) ?? [])) {
      missingRefs.push(exp.ref);
    }
  });

  return {
    hasBadReference: !syntaxOk || hasOverlap,
    outsideRefs: Array.from(new Set(outsideRefs)),
    missingRefs: missingRefs.sort(),
  };
};

/** Rows that name a reference but have no segment, and aren't part of the passage. */
const collectNoSegmentRefs = (
  rows: MarkVersesValidationRow[],
  passageRefs: string[]
): string[] => {
  const passageVerseKeys = new Set(
    passageRefs.map(verseKeyOf).filter((key): key is string => Boolean(key))
  );
  return rows
    .filter((row) => {
      if (!row.ref || row.limits) return false;
      const key = verseKeyOf(row.ref);
      return !(key && passageVerseKeys.has(key));
    })
    .map((row) => row.ref);
};

/** Hard errors that must block persisting segment markup. */
export const getMarkVersesAutosaveBlockers = (
  input: MarkVersesValidationInput
): string[] => {
  const { rows, expandedRefs, passageRefs, strings: t } = input;
  const { hasBadReference, outsideRefs } = analyzeRefs(
    expandedRefs,
    passageRefs
  );
  const noSegRefs = collectNoSegmentRefs(rows, passageRefs);

  const blockers: string[] = [];
  if (hasBadReference) blockers.push(t.badReferences);
  if (noSegRefs.length > 0) {
    blockers.push(t.noSegments.replace('{0}', noSegRefs.join(', ')));
  }
  if (outsideRefs.length > 0) {
    blockers.push(t.outsideReferences.replace('{0}', outsideRefs.join(', ')));
  }
  return blockers;
};

/** Full markup review list (warnings + errors) for the issues dialog. */
export const getMarkVersesValidationIssues = (
  input: MarkVersesValidationInput
): string[] => {
  const {
    rows,
    expandedRefs,
    passageRefs,
    hasBtRecordings,
    strings: t,
  } = input;
  const { hasBadReference, outsideRefs, missingRefs } = analyzeRefs(
    expandedRefs,
    passageRefs
  );
  const noSegRefs = collectNoSegmentRefs(rows, passageRefs);
  const noRefSegs = rows.some((row) => !row.ref && row.limits);

  const issues: string[] = [];
  if (hasBadReference) issues.push(t.badReferences);
  if (noSegRefs.length > 0) {
    issues.push(t.noSegments.replace('{0}', noSegRefs.join(', ')));
  }
  if (missingRefs.length > 0) {
    issues.push(t.missingReferences.replace('{0}', missingRefs.join(', ')));
  }
  if (outsideRefs.length > 0) {
    issues.push(t.outsideReferences.replace('{0}', outsideRefs.join(', ')));
  }
  if (noRefSegs) issues.push(t.noReferences);
  if (hasBtRecordings) issues.push(t.btNotUpdated);
  return issues;
};
