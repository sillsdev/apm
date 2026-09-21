import { ISheet } from '../../model';
import { getLastVerse } from '../../business/localParatext/getLastVerse';
import { getStartChapter, parseRef } from '../../crud/passage';

/**
 * Resolve the start chapter for a sheet row.
 * Prefers passage attributes (after parseRef), then falls back to the sheet
 * reference so Update Publishing Rows can add CHNUM rows before online DB
 * calculates startChapter (TT-7704).
 */
export function resolveSheetStartChapter(s: ISheet): number {
  if (s.passage) {
    parseRef(s.passage);
  }
  let startchap = s.passage?.attributes?.startChapter ?? 0;
  const endchap = s.passage?.attributes?.endChapter ?? 0;
  if (!startchap) {
    startchap = getStartChapter(s.reference);
  }
  if (startchap > 0 && startchap !== endchap) {
    const lastverse = getLastVerse(s.book ?? '', startchap) ?? 0;
    if (lastverse > 0) {
      const startverse = s.passage?.attributes?.startVerse ?? 0;
      const endverse = s.passage?.attributes?.endVerse ?? 0;
      if (endverse > lastverse - startverse + 1) {
        return endchap;
      }
    }
  }
  return startchap;
}
