import { ISheet } from '../../model';
import type { TitleMediaPending } from './pendingTitleMediaQueue';

/** Absolute sheet index for a visible (non-deleted, non-filtered) row, or -1. */
export function getSheetRowByVisibleIndex(
  sheet: ISheet[],
  visibleIndex: number
): number {
  let n = 0;
  let i = 0;
  while (i < sheet.length) {
    if (!sheet[i].deleted && !sheet[i].filtered) {
      if (n === visibleIndex) return i;
      n += 1;
    }
    i += 1;
  }
  return -1;
}

/**
 * Resolve where a queued title-media update should apply.
 * Prefer stable section/passage ids, then client rowKey. Fall back to visible
 * index only when none were captured. Never retarget an identified update to a
 * different row at the same index after a refresh (TT-7660).
 */
export function resolveTitleMediaRowIndex(
  sheet: ISheet[],
  pending: Pick<
    TitleMediaPending,
    'index' | 'sectionId' | 'passageId' | 'rowKey'
  >
): number {
  if (pending.sectionId) {
    return sheet.findIndex((r) => r.sectionId?.id === pending.sectionId);
  }
  if (pending.passageId) {
    return sheet.findIndex((r) => r.passage?.id === pending.passageId);
  }
  if (pending.rowKey) {
    return sheet.findIndex((r) => r.rowKey === pending.rowKey);
  }
  return getSheetRowByVisibleIndex(sheet, pending.index);
}
