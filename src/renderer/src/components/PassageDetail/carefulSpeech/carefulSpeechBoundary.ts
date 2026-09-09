import { IRegion } from '../../../crud/useWavesurferRegions';

export const CLAUSE_BOUNDARY_THRESHOLD_SEC = 0.1;

export function regionsJsonFromList(
  regions: IRegion[],
  params?: object
): string {
  return JSON.stringify({
    params: params ?? {},
    regions,
  });
}

export function hasPhraseRegions(segmentsJson: string): boolean {
  try {
    const parsed = JSON.parse(segmentsJson) as { regions?: IRegion[] };
    return Array.isArray(parsed.regions) && parsed.regions.length > 0;
  } catch {
    return false;
  }
}

export const REGION_EQ_TOLERANCE = 0.05;

/** True when two regions share the same start/end within tolerance (labels
 *  ignored). The single boundary-equality rule every clause matcher builds on,
 *  so they cannot disagree if the tolerance changes (TT-7666). */
export function regionsMatch(
  a: IRegion,
  b: IRegion,
  tolerance = REGION_EQ_TOLERANCE
): boolean {
  return (
    Math.abs(a.start - b.start) < tolerance &&
    Math.abs(a.end - b.end) < tolerance
  );
}

/** True when both maps have the same start/end boundaries (labels ignored). */
export function regionBoundariesEqual(
  aJson: string,
  bJson: string,
  tolerance = REGION_EQ_TOLERANCE
): boolean {
  const a = parseRegionList(aJson);
  const b = parseRegionList(bJson);
  if (a.length !== b.length) return false;
  return a.every((region, i) => regionsMatch(region, b[i], tolerance));
}

function parseRegionList(segmentsJson: string): IRegion[] {
  try {
    const parsed = JSON.parse(segmentsJson) as { regions?: IRegion[] };
    return Array.isArray(parsed.regions) ? parsed.regions : [];
  } catch {
    return [];
  }
}

/**
 * Recorded units must still exist as exact regions after a boundary edit
 * (no split inside / no combine across a recorded segment).
 */
export function preservesRecordedBoundaries(
  oldRegions: IRegion[],
  newRegions: IRegion[],
  completed: Set<number>,
  tolerance = REGION_EQ_TOLERANCE
): boolean {
  for (const i of completed) {
    const r = oldRegions[i];
    if (!r) continue;
    const stillExists = newRegions.some((n) => regionsMatch(n, r, tolerance));
    if (!stillExists) return false;
  }
  return true;
}

/**
 * Index of the clause whose boundaries match `region`, or -1. Lets callers
 * remember a recorded take by the boundaries it was cut against and re-derive
 * its current clause index after the clauses are re-segmented — the same way
 * getCompletedClauseIndices re-matches saved mediafiles to the live regions,
 * so index tracking cannot drift when an earlier clause is split or combined
 * (TT-7666).
 */
export function clauseIndexForRegion(
  region: IRegion,
  clauseRegions: IRegion[],
  tolerance = REGION_EQ_TOLERANCE
): number {
  return clauseRegions.findIndex((c) => regionsMatch(c, region, tolerance));
}

/** @deprecated Prefer hasPhraseRegions — kept for BOLD clause naming at call sites. */
export const hasClauseRegions = hasPhraseRegions;
