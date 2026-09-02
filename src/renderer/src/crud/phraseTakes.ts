import { MediaFile } from '../model';
import { IRegion } from './useWavesurferRegions';

/**
 * Which take belongs to which phrase segment, and which take of a segment wins.
 *
 * A Careful Speech / Phrase BT take names the slice of vernacular it covers in
 * `sourceSegments`. That is the only link back to a segment: segments are not
 * records, they are boundaries stored on the vernacular's named regions, and
 * moving a boundary rewrites them in place. Takes recorded before the move are
 * left answering to boundaries that no longer exist (TT-7666).
 *
 * Lives in crud/ rather than beside the step because the Transcribe task list
 * is built in the context layer, which should not have to reach into a
 * component subtree for it.
 */

/**
 * Seconds of slack allowed between a take's stored region and a segment.
 *
 * Half of the 0.1s grid `prettySegment` rounds to, so a take is never judged
 * stale over a difference the UI cannot show - a take labelled `0.0-5.9` always
 * matches the segment labelled `0.0-5.9`. Boundaries are stored to five
 * decimals (`roundToFiveDecimals` in useWavesurferRegions), so anything wider
 * than this is a boundary someone actually moved, which is what we mean to call
 * stale. Compared with `<=` because a value rounded to tenths lands exactly on
 * the tolerance, and hiding a recording is worse than keeping a duplicate row.
 */
export const PHRASE_REGION_TOLERANCE = 0.05;

/** The region a take names, or undefined when it names none. */
export function parseTakeSourceRegion(
  sourceSegments: string | undefined
): IRegion | undefined {
  if (!sourceSegments) return undefined;
  try {
    const parsed = JSON.parse(sourceSegments) as IRegion;
    if (parsed?.start !== undefined && parsed?.end !== undefined) return parsed;
  } catch {
    return undefined;
  }
  return undefined;
}

/** True when two regions name the same slice, within the tolerance. */
export function regionsMatch(a: IRegion, b: IRegion): boolean {
  return (
    Math.abs(a.start - b.start) <= PHRASE_REGION_TOLERANCE &&
    Math.abs(a.end - b.end) <= PHRASE_REGION_TOLERANCE
  );
}

/**
 * True when a take's stored region is the given segment. Callers that already
 * hold the parsed region compare with `regionsMatch` instead of parsing again.
 */
export function takeMatchesRegion(
  sourceSegments: string | undefined,
  region: IRegion
): boolean {
  const stored = parseTakeSourceRegion(sourceSegments);
  return stored ? regionsMatch(stored, region) : false;
}

/**
 * Newest take first. The id breaks a tie on the creation date so the same take
 * is picked every time - two takes saved in the same second otherwise swap
 * places between renders.
 */
export function compareTakesNewestFirst(
  a: MediaFile | undefined,
  b: MediaFile | undefined
): number {
  const da = a?.attributes?.dateCreated ?? '';
  const db = b?.attributes?.dateCreated ?? '';
  if (da !== db) return db.localeCompare(da);
  return (b?.id ?? '').localeCompare(a?.id ?? '');
}

/**
 * The takes still worth showing for `regions`: the newest take of each segment,
 * plus every take that names no segment at all.
 *
 * Takes naming a segment that is not in `regions` are dropped - they were
 * recorded against boundaries the step has since moved away from, so no step
 * will ever offer them again. An empty `regions` returns the takes untouched:
 * with no boundaries to compare against nothing can be called stale, and
 * hiding audio on a guess is worse than a duplicate row. Takes with no
 * `sourceSegments` (Retell, and anything recorded before segment maps) are kept
 * for the same reason. Input order is preserved; callers sort for display.
 */
export function selectCurrentPhraseTakes<T extends MediaFile>(
  takes: T[],
  regions: IRegion[]
): T[] {
  if (regions.length === 0 || takes.length === 0) return takes;
  // Parse each take once (not once per take-region pair). A passage can hold
  // one take per segment per pass, so parsing inside the region loop would
  // repeatedly parse the same take for every region.
  const named = takes.map((take) => ({
    take,
    region: parseTakeSourceRegion(take.attributes?.sourceSegments),
  }));
  const current = new Set<T>();
  regions.forEach((region) => {
    const newest = named
      .filter((n) => n.region && regionsMatch(n.region, region))
      .map((n) => n.take)
      .sort(compareTakesNewestFirst)[0];
    if (newest) current.add(newest);
  });
  return named
    .filter((n) => current.has(n.take) || !n.region)
    .map((n) => n.take);
}
