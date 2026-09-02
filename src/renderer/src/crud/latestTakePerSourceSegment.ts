import { MediaFile } from '../model';
import { related } from './related';

/**
 * Collapse guided-phrase takes to one per segment: the newest.
 *
 * A segment can end up with several takes if the user re-records - nothing prunes the superseded
 * ones - and only the newest should be shown. Use this filter to avoid showing the dead extra takes,
 * as happened in the Transcribe task list before TT-7666.
 *
 * Takes whose `sourceSegments` cannot be read are left alone: they are not
 * per-segment takes, so there is nothing to collapse them against. So are takes
 * with no readable `sourceMedia`: without knowing which vernacular a take was
 * cut from, boundaries alone do not say two takes are of the same segment, and
 * collapsing on them would drop a task that is really someone else's work.
 */

/** `start|end` at 2dp, or undefined when this is not a per-segment take. */
function segmentKey(seg: string | undefined | null): string | undefined {
  if (!seg) return undefined;
  try {
    const parsed = JSON.parse(seg) as { start?: number; end?: number };
    if (typeof parsed?.start !== 'number' || typeof parsed?.end !== 'number') {
      return undefined;
    }
    return `${parsed.start.toFixed(2)}|${parsed.end.toFixed(2)}`;
  } catch {
    return undefined;
  }
}

/**
 * Which of two takes of a segment supersedes the other: the later
 * `dateCreated`, and on a tie the higher id, so the answer is stable whatever
 * order the rows arrive in. `pickLatestGuidedOutputRow` shows what this keeps,
 * so it has to agree - it calls this.
 */
export function isNewerTake(
  candidate: MediaFile | undefined,
  incumbent: MediaFile | undefined
): boolean {
  const dc = candidate?.attributes?.dateCreated ?? '';
  const di = incumbent?.attributes?.dateCreated ?? '';
  if (dc !== di) return dc > di;
  return (candidate?.id ?? '') > (incumbent?.id ?? '');
}

export function latestTakePerSourceSegment<T extends MediaFile>(
  media: T[]
): T[] {
  const winners = new Map<string, T>();
  const perSegment = new Set<T>();
  for (const m of media) {
    const seg = segmentKey(m.attributes?.sourceSegments);
    if (seg === undefined) continue;
    const source = related(m, 'sourceMedia');
    if (!source) continue;
    perSegment.add(m);
    const key = `${source}|${seg}`;
    const held = winners.get(key);
    if (!held || isNewerTake(m, held)) winners.set(key, m);
  }
  const kept = new Set(winners.values());
  return media.filter((m) => !perSegment.has(m) || kept.has(m));
}
