import { GridSortModel } from '@mui/x-data-grid';
import { DateTime } from 'luxon';

export function numCompare(a: number, b: number): number {
  return a - b;
}
export function strNumCompare(a: string, b: string): number {
  return parseInt(a) - parseInt(b);
}
export function strCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export const doSort =
  (sortModel: GridSortModel) =>
  (a: Record<string, any>, b: Record<string, any>) => {
    if (sortModel.length === 0) return 0;
    for (const sort of sortModel) {
      const field = sort.field;
      const direction = sort.sort === 'asc' ? 1 : -1;
      let result = 0;
      if (field === 'version') {
        result = strNumCompare(a.version, b.version) * direction;
      } else {
        result = strCompare(a.fileName, b.fileName) * direction;
      }
      if (result !== 0) return result;
    }
    return 0;
  };

// Attempt to parse using several common formats (replacement for prior moment fallback including 'LT').
function parseFlexible(value: string): DateTime {
  let dt = DateTime.fromISO(value);
  if (!dt.isValid) dt = DateTime.fromRFC2822(value);
  if (!dt.isValid) dt = DateTime.fromSQL(value);
  // Try common time-only patterns that might correspond to moment's localized 'LT'
  if (!dt.isValid) dt = DateTime.fromFormat(value, 'h:mm a');
  if (!dt.isValid) dt = DateTime.fromFormat(value, 'H:mm');
  return dt;
}

export function dateCompare(a: string, b: string): number {
  const aDate = parseFlexible(a);
  const bDate = parseFlexible(b);
  const aIso = aDate.isValid ? (aDate.toISO() ?? '') : '';
  const bIso = bDate.isValid ? (bDate.toISO() ?? '') : '';
  if (aIso > bIso) return 1;
  if (aIso < bIso) return -1;
  return 0;
}
