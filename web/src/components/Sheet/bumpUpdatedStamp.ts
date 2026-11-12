import { currentDateTime } from '../../utils/currentDateTime';

/**
 * Stamp strictly newer than both the last successful save and the row's
 * previous stamp. Equal timestamps skip persist (TT-7660).
 */
export function bumpUpdatedStamp(
  prev: string | undefined,
  lastSaved: string | undefined,
  now: () => string = currentDateTime
): string {
  let stamp = now();
  const floor = lastSaved;
  if (floor && stamp <= floor) {
    const nextMs = Date.parse(floor) + 1;
    stamp = Number.isFinite(nextMs) ? new Date(nextMs).toISOString() : stamp;
  }
  if (prev && stamp <= prev) {
    const nextMs = Date.parse(prev) + 1;
    stamp = Number.isFinite(nextMs) ? new Date(nextMs).toISOString() : stamp;
  }
  return stamp;
}
