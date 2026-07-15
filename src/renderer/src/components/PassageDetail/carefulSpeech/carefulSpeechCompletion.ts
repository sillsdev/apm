import { related } from '../../../crud/related';
import { IRegion } from '../../../crud/useWavesurferRegions';
import { IRow } from '../../../context/PassageDetailContext';
import { prettySegment } from '../../../utils/prettySegment';

const REGION_TOLERANCE = 0.05;

function isEmptySourceSegments(seg: string | undefined): boolean {
  if (!seg) return true;
  const trimmed = seg.trim();
  if (trimmed === '' || trimmed === '{}') return true;
  try {
    const parsed = JSON.parse(trimmed) as { start?: number; end?: number };
    return parsed?.start === undefined && parsed?.end === undefined;
  } catch {
    return false;
  }
}

function parseStoredRegion(seg: string | undefined): IRegion | undefined {
  if (!seg) return undefined;
  try {
    const parsed = JSON.parse(seg) as IRegion;
    if (parsed?.start !== undefined && parsed?.end !== undefined) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function regionMatchesClause(
  storedSeg: string | undefined,
  clauseRegion: IRegion,
  options?: { singleSegmentMode?: boolean; clauseIndex?: number }
): boolean {
  if (
    options?.singleSegmentMode &&
    options.clauseIndex === 0 &&
    isEmptySourceSegments(storedSeg)
  ) {
    return true;
  }
  const stored = parseStoredRegion(storedSeg);
  if (stored) {
    return (
      Math.abs(stored.start - clauseRegion.start) < REGION_TOLERANCE &&
      Math.abs(stored.end - clauseRegion.end) < REGION_TOLERANCE
    );
  }
  return prettySegment(storedSeg).trim() === prettySegment(clauseRegion).trim();
}

function matchesSourceVersion(
  row: IRow,
  sourceVersion: number,
  vernacularMediaId?: string
): boolean {
  if (row.sourceVersion === sourceVersion) return true;
  if (!vernacularMediaId) return false;
  return related(row.mediafile, 'sourceMedia') === vernacularMediaId;
}

export function getRecordingForClause(
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number,
  clauseRegion: IRegion,
  vernacularMediaId?: string,
  singleSegmentMode?: boolean,
  clauseIndex?: number
): IRow | undefined {
  const matches = rowData.filter(
    (r) =>
      related(r.mediafile, 'artifactType') === recordTypeId &&
      matchesSourceVersion(r, sourceVersion, vernacularMediaId) &&
      regionMatchesClause(
        r.mediafile?.attributes?.sourceSegments,
        clauseRegion,
        { singleSegmentMode, clauseIndex }
      )
  );
  if (matches.length === 0) return undefined;
  const exactVersion = matches.find((r) => r.sourceVersion === sourceVersion);
  return exactVersion ?? matches[0];
}

export function getCompletedClauseIndices(
  clauseRegions: IRegion[],
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number,
  vernacularMediaId?: string,
  singleSegmentMode?: boolean
): Set<number> {
  const completed = new Set<number>();
  clauseRegions.forEach((region, index) => {
    if (
      getRecordingForClause(
        rowData,
        recordTypeId,
        sourceVersion,
        region,
        vernacularMediaId,
        singleSegmentMode,
        index
      )
    ) {
      completed.add(index);
    }
  });
  return completed;
}

export function firstIncompleteClauseIndex(
  clauseRegions: IRegion[],
  completed: Set<number>
): number {
  const idx = clauseRegions.findIndex((_, i) => !completed.has(i));
  return idx >= 0 ? idx : clauseRegions.length;
}
