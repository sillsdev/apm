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

const REGION_EQ_TOLERANCE = 0.05;

/** True when both maps have the same start/end boundaries (labels ignored). */
export function regionBoundariesEqual(
  aJson: string,
  bJson: string,
  tolerance = REGION_EQ_TOLERANCE
): boolean {
  const a = parseRegionList(aJson);
  const b = parseRegionList(bJson);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i].start - b[i].start) > tolerance ||
      Math.abs(a[i].end - b[i].end) > tolerance
    ) {
      return false;
    }
  }
  return true;
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
    const stillExists = newRegions.some(
      (n) =>
        Math.abs(n.start - r.start) < tolerance &&
        Math.abs(n.end - r.end) < tolerance
    );
    if (!stillExists) return false;
  }
  return true;
}

/** @deprecated Prefer hasPhraseRegions — kept for BOLD clause naming at call sites. */
export const hasClauseRegions = hasPhraseRegions;
