import { type RefObject } from 'react';
import { type ApplyRegionColor } from '../crud/useWavesurferRegions';

/** Waveform / table colors for Mark Verses (completed / current / unmarked). */

export const MARK_VERSES_COMPLETED_RGBA = 'rgba(76, 175, 80, 0.35)';
export const MARK_VERSES_CURRENT_RGBA = 'rgba(255, 235, 59, 0.5)';
export const MARK_VERSES_UNMARKED_RGBA = 'rgba(158, 158, 158, 0.22)';

export const getMarkVersesCompletedColor = () => MARK_VERSES_COMPLETED_RGBA;
export const getMarkVersesCurrentColor = () => MARK_VERSES_CURRENT_RGBA;
export const getMarkVersesUnmarkedColor = () => MARK_VERSES_UNMARKED_RGBA;

export const markVersesRowHasLimits = (limitsValue: string | undefined) =>
  Boolean(limitsValue?.trim());

export const markVersesLastRowWithLimits = (
  hasLimits: (rowIndex: number) => boolean,
  rowCount: number
) => {
  let last = 0;
  for (let i = 1; i < rowCount; i++) {
    if (hasLimits(i)) last = i;
  }
  return last;
};

export const markVersesHasUnmarkedFollowingRows = (
  hasLimits: (rowIndex: number) => boolean,
  rowIndex: number,
  rowCount: number
) => {
  for (let i = rowIndex + 1; i < rowCount; i++) {
    if (!hasLimits(i)) return true;
  }
  return false;
};

/** Row is fully marked when it has limits and is not the open tail before unmarked verses. */
export const isMarkVersesRowCompleted = (
  hasLimits: (rowIndex: number) => boolean,
  rowIndex: number,
  rowCount: number
) => {
  if (rowIndex <= 0 || rowIndex >= rowCount) return false;
  if (!hasLimits(rowIndex)) return false;
  const last = markVersesLastRowWithLimits(hasLimits, rowCount);
  if (rowIndex < last) return true;
  return !markVersesHasUnmarkedFollowingRows(hasLimits, rowIndex, rowCount);
};

export const isMarkVersesTailIncomplete = (
  hasLimits: (rowIndex: number) => boolean,
  rowCount: number
) => markVersesHasUnmarkedFollowingRows(hasLimits, 1, rowCount);

export const getMarkVersesRegionBaseColor = (
  regionIndex: number,
  regionCount: number,
  tailIncomplete: boolean
) => {
  if (tailIncomplete && regionCount > 0 && regionIndex === regionCount - 1) {
    return getMarkVersesUnmarkedColor();
  }
  return getMarkVersesCompletedColor();
};

export const createMarkVersesApplyRegionColor = (
  tailOpenRef: RefObject<boolean>
): ApplyRegionColor => {
  return (role, regionIndex, regionCount) => {
    if (role === 'current') return getMarkVersesCurrentColor();
    if (role === 'new') {
      return tailOpenRef.current
        ? getMarkVersesUnmarkedColor()
        : getMarkVersesCompletedColor();
    }
    return getMarkVersesRegionBaseColor(
      regionIndex,
      regionCount,
      tailOpenRef.current ?? false
    );
  };
};

export const isMarkVersesTableRowCompleted = (
  tableData: { value?: string }[][],
  rowIndex: number,
  limitsCol = 0
) => {
  const hasLimits = (i: number) =>
    markVersesRowHasLimits(tableData[i]?.[limitsCol]?.value);
  return isMarkVersesRowCompleted(hasLimits, rowIndex, tableData.length);
};

export const isMarkVersesTableTailIncomplete = (
  tableData: { value?: string }[][],
  limitsCol = 0
) => {
  const hasLimits = (i: number) =>
    markVersesRowHasLimits(tableData[i]?.[limitsCol]?.value);
  return isMarkVersesTailIncomplete(hasLimits, tableData.length);
};

/**
 * Semantic state of a Mark Verses reference cell, independent of the `className`
 * styling string. Drives both styling and edit affordances. String-valued so the
 * serialized form (`tableSignature`, fixtures) stays human-readable.
 */
export enum RefStatus {
  /** Well-formed and in range (or empty): nothing to flag. */
  Valid = 'valid',
  /** Ill-formatted (fails `refMatch`); rendered red. */
  Err = 'err',
  /** Well-formed but out of range / breaks consecutive numbering; rendered with a warning icon. */
  Warn = 'warn',
}
