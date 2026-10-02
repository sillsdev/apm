import { ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { SectionArray } from '../../model/SectionArray';
import { normalizeReference } from '../../utils/sort';
import { positiveWholeOnly } from '../../utils/positiveWholeOnly';
import { refMatch } from '../../utils/refMatch';
import { isPassageRow, isSectionRow } from './isSectionPassage';

/**
 * Resolve a Plan Sheet "go to" query to a row index (0-based into rowInfo).
 *
 * Priority (first match wins):
 * 1. Publishing labels M{n} S{m} (and S-only when that is the displayed label), when publishing rows are visible and the sheet is not filtered.
 * 2. Section.passage display form "N.N" when publishing rows are hidden (scripture and general; flat often uses passage sequence 1).
 * 3. Scripture reference (optional book token via lookupBook): equality on
 *    normalizeReference first; if no hit, numeric chapter:verse spans overlap
 *    (e.g. row 1:67-80 matches query 1:68) — only when opts.scripture is true.
 * 4. General / non-scripture: exact reference text match (trimmed, case-insensitive) on passage rows — also used as a last fallback for scripture projects.
 * 5. Free-text phrase: next section (after the current row’s section, wrapping to the top) whose section title, references, or comments contain the phrase (case-insensitive substring). Jumps to the same row target as publishing M/S (`firstRowForSectionSeq`).
 *
 * Flat (SectionPassage) rows use the same rules; isPassageRow covers them.
 */

export type FindPlanSheetReferenceResult =
  | { ok: true; rowIndex: number }
  | { ok: false; error: 'not_found' | 'ms_unavailable_filtered' };

const normLabel = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();

/** User query looks like a publishing row label (M/S or S-only). */
export function looksLikePublishingReferenceQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return /^M\s*\d+\s*S\s*\d+$/i.test(q) || /^S\s*\d+$/i.test(q);
}

function normalizeMsQuery(query: string): string | null {
  const q = query.trim().replace(/\s+/g, ' ');
  const mFull = /^M\s*(\d+)\s*S\s*(\d+)$/i.exec(q);
  if (mFull) {
    return `M${mFull[1]} S${mFull[2]}`;
  }
  const mS = /^S\s*(\d+)$/i.exec(q);
  if (mS) {
    return `S${mS[1]}`;
  }
  return null;
}

function findSectionSeqFromPublishingLabel(
  sectionArr: SectionArray,
  normalizedQuery: string
): number | undefined {
  const want = normLabel(normalizedQuery);
  for (const [seq, label] of sectionArr) {
    if (normLabel(label) === want) {
      return seq;
    }
  }
  return undefined;
}

function firstRowForSectionSeq(
  rowInfo: ISheet[],
  sectionSeq: number
): number | undefined {
  const passIdx = rowInfo.findIndex(
    (r) =>
      isPassageRow(r) &&
      r.passageType === PassageTypeEnum.PASSAGE &&
      r.sectionSeq === sectionSeq
  );
  if (passIdx >= 0) return passIdx;

  const secIdx = rowInfo.findIndex(
    (r) =>
      isSectionRow(r) &&
      !isPassageRow(r) &&
      r.sectionSeq === sectionSeq &&
      r.kind === IwsKind.Section &&
      r.level === SheetLevel.Section
  );
  if (secIdx >= 0) return secIdx;

  const anyIdx = rowInfo.findIndex(
    (r) => isSectionRow(r) && r.sectionSeq === sectionSeq
  );
  return anyIdx >= 0 ? anyIdx : undefined;
}

function findBySeqDot(
  rowInfo: ISheet[],
  sectionPart: string,
  passagePart: string
): number | undefined {
  for (let i = 0; i < rowInfo.length; i++) {
    const r = rowInfo[i];
    if (!isPassageRow(r)) continue;
    const sec = positiveWholeOnly(r.sectionSeq);
    const psq = positiveWholeOnly(r.passageSeq);
    if (sec === sectionPart && psq === passagePart) {
      return i;
    }
  }
  return undefined;
}

function parseScriptureQuery(
  query: string,
  lookupBook: (book: string) => string
): { ref: string; book?: string } | null {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const words = trimmed.split(' ');
  for (let i = words.length - 1; i >= 0; i--) {
    const candidateRef = words.slice(i).join(' ');
    if (refMatch(candidateRef)) {
      const bookTokens = words.slice(0, i).join(' ').trim();
      if (bookTokens) {
        const code = lookupBook(bookTokens);
        if (!code) return null;
        return { ref: candidateRef, book: code.toLocaleUpperCase() };
      }
      return { ref: candidateRef };
    }
  }
  return null;
}

type VersePoint = { ch: number; v: number };
type VerseSpan = { start: VersePoint; end: VersePoint };

function cmpVersePoint(a: VersePoint, b: VersePoint): number {
  if (a.ch !== b.ch) return a.ch - b.ch;
  return a.v - b.v;
}

/**
 * Parses refs that match {@link normalizeReference}'s numeric pattern
 * (chapter[:.]startVerse, optional same-chapter end verse, or cross-chapter end).
 */
function parseVerseRefSpan(ref: string): VerseSpan | null {
  const trimmed = ref.trim();
  const m = trimmed.match(/^(\d+)[:.](\d+)(?:-(\d+)(?::(\d+))?)?$/);
  if (!m) return null;
  const ch = parseInt(m[1], 10);
  const v0 = parseInt(m[2], 10);
  if (Number.isNaN(ch) || Number.isNaN(v0)) return null;
  if (!m[3]) {
    const p: VersePoint = { ch, v: v0 };
    return { start: p, end: p };
  }
  const n3 = parseInt(m[3], 10);
  if (m[4] !== undefined && m[4] !== '') {
    const endV = parseInt(m[4], 10);
    if (Number.isNaN(n3) || Number.isNaN(endV)) return null;
    const start: VersePoint = { ch, v: v0 };
    const end: VersePoint = { ch: n3, v: endV };
    if (cmpVersePoint(start, end) > 0) return null;
    return { start, end };
  }
  const endV = n3;
  if (Number.isNaN(endV)) return null;
  const start: VersePoint = { ch, v: v0 };
  const end: VersePoint = { ch, v: endV };
  if (cmpVersePoint(start, end) > 0) return null;
  return { start, end };
}

/** Inclusive overlap on (chapter, verse) lexicographic order. */
function verseSpansOverlap(a: VerseSpan, b: VerseSpan): boolean {
  return (
    cmpVersePoint(a.start, b.end) <= 0 && cmpVersePoint(b.start, a.end) <= 0
  );
}

function findScriptureRow(
  rowInfo: ISheet[],
  parsed: { ref: string; book?: string }
): number | undefined {
  const { ref, book: fixedBook } = parsed;

  for (let i = 0; i < rowInfo.length; i++) {
    const row = rowInfo[i];
    if (!isPassageRow(row) || row.passageType !== PassageTypeEnum.PASSAGE) {
      continue;
    }
    const rowBook = (row.book || '').toLocaleUpperCase();
    if (fixedBook && rowBook !== fixedBook) {
      continue;
    }
    const refStr = row.reference || '';
    if (!refMatch(refStr)) {
      continue;
    }
    const bookKey = fixedBook || rowBook;
    if (!bookKey) continue;
    if (
      normalizeReference(bookKey, ref) ===
      normalizeReference(rowBook || bookKey, refStr)
    ) {
      return i;
    }
  }

  const querySpan = parseVerseRefSpan(ref);
  if (!querySpan) return undefined;

  for (let i = 0; i < rowInfo.length; i++) {
    const row = rowInfo[i];
    if (!isPassageRow(row) || row.passageType !== PassageTypeEnum.PASSAGE) {
      continue;
    }
    const rowBook = (row.book || '').toLocaleUpperCase();
    if (fixedBook && rowBook !== fixedBook) {
      continue;
    }
    const refStr = row.reference || '';
    if (!refMatch(refStr)) {
      continue;
    }
    const bookKey = fixedBook || rowBook;
    if (!bookKey) continue;
    const rowSpan = parseVerseRefSpan(refStr);
    if (!rowSpan) continue;
    if (verseSpansOverlap(querySpan, rowSpan)) {
      return i;
    }
  }
  return undefined;
}

function normalizeGeneralRef(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function haystackPartsFromRow(r: ISheet): string[] {
  return [r.title, r.reference, r.comment].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
}

type SectionPhraseBlock = {
  sectionSeq: number;
  firstRowIndex: number;
  lastRowIndex: number;
  haystack: string;
};

/** Contiguous rows sharing `sectionSeq` become one searchable block. */
function buildSectionPhraseBlocks(rowInfo: ISheet[]): SectionPhraseBlock[] {
  const blocks: SectionPhraseBlock[] = [];
  let i = 0;
  const n = rowInfo.length;
  while (i < n) {
    const seq = rowInfo[i].sectionSeq;
    const firstRowIndex = i;
    const parts: string[] = [];
    while (i < n && rowInfo[i].sectionSeq === seq) {
      parts.push(...haystackPartsFromRow(rowInfo[i]));
      i++;
    }
    const lastRowIndex = i - 1;
    blocks.push({
      sectionSeq: seq,
      firstRowIndex,
      lastRowIndex,
      haystack: normalizeGeneralRef(parts.join(' ')),
    });
  }
  return blocks;
}

function blockIndexContainingRow(
  blocks: SectionPhraseBlock[],
  rowIndex: number
): number {
  for (let b = 0; b < blocks.length; b++) {
    const { firstRowIndex, lastRowIndex } = blocks[b];
    if (rowIndex >= firstRowIndex && rowIndex <= lastRowIndex) {
      return b;
    }
  }
  return -1;
}

/** Avoid treating structured go-to patterns as substring phrase search. */
function eligibleForSectionPhraseSearch(
  trimmed: string,
  opts: { scripture: boolean; lookupBook: (book: string) => string }
): boolean {
  if (trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (looksLikePublishingReferenceQuery(trimmed)) return false;
  if (/^(\d+)\.(\d+)$/.test(trimmed)) return false;
  if (opts.scripture && parseScriptureQuery(trimmed, opts.lookupBook)) {
    return false;
  }
  if (refMatch(trimmed)) return false;
  return true;
}

/**
 * Finds the next section (forward then wrap) whose haystack contains `needleNorm`.
 * Uses `firstRowForSectionSeq` for the jump row (first passage when present, else section row).
 */
function findNextSectionRowByPhrase(
  rowInfo: ISheet[],
  needleNorm: string,
  currentRowIndex0: number
): number | undefined {
  if (!needleNorm) return undefined;
  const blocks = buildSectionPhraseBlocks(rowInfo);
  if (blocks.length === 0) return undefined;

  const tryBlock = (b: number): number | undefined => {
    if (!blocks[b].haystack.includes(needleNorm)) return undefined;
    return firstRowForSectionSeq(rowInfo, blocks[b].sectionSeq);
  };

  if (currentRowIndex0 < 0 || currentRowIndex0 >= rowInfo.length) {
    for (let b = 0; b < blocks.length; b++) {
      const hit = tryBlock(b);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  const blockIdx = blockIndexContainingRow(blocks, currentRowIndex0);

  if (blockIdx < 0) {
    for (let b = 0; b < blocks.length; b++) {
      const hit = tryBlock(b);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  for (let b = blockIdx + 1; b < blocks.length; b++) {
    const hit = tryBlock(b);
    if (hit !== undefined) return hit;
  }
  for (let b = 0; b < blockIdx; b++) {
    const hit = tryBlock(b);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Exact reference string match for general (or fallback) projects. */
function findGeneralReferenceRow(
  rowInfo: ISheet[],
  query: string
): number | undefined {
  const want = normalizeGeneralRef(query);
  if (!want) return undefined;
  for (let i = 0; i < rowInfo.length; i++) {
    const r = rowInfo[i];
    if (!isPassageRow(r)) continue;
    const ref = r.reference;
    if (typeof ref !== 'string' || !ref.trim()) continue;
    if (normalizeGeneralRef(ref) === want) {
      return i;
    }
  }
  return undefined;
}

export function findPlanSheetRowFromReferenceQuery(
  query: string,
  rowInfo: ISheet[],
  opts: {
    publishingOn: boolean;
    hidePublishing: boolean;
    filtered: boolean;
    sectionArr: SectionArray;
    inlinePassages: boolean;
    lookupBook: (book: string) => string;
    /** When false, verse-style parsing (chapter:verse) is skipped; N.N and plain reference still apply. */
    scripture: boolean;
    /** 0-based `rowInfo` index of the current sheet row; used for "next section" phrase search. Use -1 when unknown. */
    currentRowIndex0?: number;
  }
): FindPlanSheetReferenceResult {
  void opts.inlinePassages;
  const currentRowIndex0 = opts.currentRowIndex0 ?? -1;
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: 'not_found' };
  }

  const publishingLabelsVisible = opts.publishingOn && !opts.hidePublishing;
  const publishingHidden = !opts.publishingOn || opts.hidePublishing;

  if (
    publishingLabelsVisible &&
    opts.filtered &&
    looksLikePublishingReferenceQuery(trimmed)
  ) {
    return { ok: false, error: 'ms_unavailable_filtered' };
  }

  if (publishingLabelsVisible && !opts.filtered) {
    const msNorm = normalizeMsQuery(trimmed);
    if (msNorm) {
      const want = normLabel(msNorm);
      const seq = findSectionSeqFromPublishingLabel(opts.sectionArr, want);
      if (seq !== undefined) {
        const rowIndex = firstRowForSectionSeq(rowInfo, seq);
        if (rowIndex !== undefined) {
          return { ok: true, rowIndex };
        }
      }
    }
  }

  if (publishingHidden) {
    const mDot = /^(\d+)\.(\d+)$/.exec(trimmed);
    if (mDot) {
      const rowIndex = findBySeqDot(rowInfo, mDot[1], mDot[2]);
      if (rowIndex !== undefined) {
        return { ok: true, rowIndex };
      }
    }
  }

  if (opts.scripture) {
    const parsed = parseScriptureQuery(trimmed, opts.lookupBook);
    if (parsed) {
      const rowIndex = findScriptureRow(rowInfo, parsed);
      if (rowIndex !== undefined) {
        return { ok: true, rowIndex };
      }
    }
  }

  const generalIdx = findGeneralReferenceRow(rowInfo, trimmed);
  if (generalIdx !== undefined) {
    return { ok: true, rowIndex: generalIdx };
  }

  if (eligibleForSectionPhraseSearch(trimmed, opts)) {
    const needleNorm = normalizeGeneralRef(trimmed);
    const phraseIdx = findNextSectionRowByPhrase(
      rowInfo,
      needleNorm,
      currentRowIndex0
    );
    if (phraseIdx !== undefined) {
      return { ok: true, rowIndex: phraseIdx };
    }
  }

  return { ok: false, error: 'not_found' };
}
