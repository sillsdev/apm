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
 * 3. Scripture reference (optional book token via lookupBook), equality on normalizeReference — only when opts.scripture is true.
 * 4. General / non-scripture: exact reference text match (trimmed, case-insensitive) on passage rows — also used as a last fallback for scripture projects.
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
  return undefined;
}

function normalizeGeneralRef(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
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
  }
): FindPlanSheetReferenceResult {
  void opts.inlinePassages;
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: 'not_found' };
  }

  const publishingLabelsVisible = opts.publishingOn && !opts.hidePublishing;
  const publishingHidden = !opts.publishingOn || opts.hidePublishing;

  if (publishingLabelsVisible && opts.filtered && looksLikePublishingReferenceQuery(trimmed)) {
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

  return { ok: false, error: 'not_found' };
}
