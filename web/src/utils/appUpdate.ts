/**
 * Pure helpers for the "update available" check (userversions endpoint, which
 * reports the currentversion row for the desktop app).
 */
import { DateTime } from 'luxon';

/** Short localized date for the release, or '' when it is missing/invalid. */
export function formatReleaseDate(iso: string, lang: string): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso);
  return dt.isValid
    ? dt.setLocale(lang).toLocaleString(DateTime.DATE_SHORT)
    : '';
}

export interface LatestVersionInfo {
  /** e.g. "4.7.3" or, for the web build notice, "4.7.3 beta" */
  desktopVersion: string;
  /** ISO timestamp the currentversion row was updated (UTC) */
  dateUpdated: string;
}

/** Validate the userversions response before trusting its shape. */
export function parseLatestVersion(data: unknown): LatestVersionInfo | null {
  if (!data || typeof data !== 'object') return null;
  const { desktopVersion, dateUpdated } = data as Record<string, unknown>;
  if (typeof desktopVersion !== 'string' || desktopVersion.trim() === '')
    return null;
  let date = typeof dateUpdated === 'string' ? dateUpdated : '';
  // The server stores UTC but omits the zone designator.
  if (date !== '' && !/(Z|[+-]\d\d:?\d\d)$/.test(date)) date += 'Z';
  return { desktopVersion: desktopVersion.trim(), dateUpdated: date };
}

const versionParts = (version: string): number[] =>
  (version.trim().split(/\s+/)[0] ?? '')
    .split('.')
    .map((p) => Number.parseInt(p, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));

/**
 * True when `latest` is a strictly higher version than `current`. Only the
 * first space-separated token is compared, so "4.7.3 beta" counts as 4.7.3.
 * Equal or older server versions never prompt (a dev build ahead of the
 * currentversion row must not be told to "update" to an older release).
 */
export function isNewerVersion(latest: string, current: string): boolean {
  if (!latest.trim() || !current.trim()) return false;
  const a = versionParts(latest);
  const b = versionParts(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
