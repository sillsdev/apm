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

/** @deprecated Prefer hasPhraseRegions — kept for BOLD clause naming at call sites. */
export const hasClauseRegions = hasPhraseRegions;
