import { DateTime } from 'luxon';

export function numCompare(a: number, b: number): number {
  return a - b;
}
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
