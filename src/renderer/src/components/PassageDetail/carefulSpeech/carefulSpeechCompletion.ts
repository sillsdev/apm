import { IRegion } from '../../../crud/useWavesurferRegions';
import { IRow } from '../../../context/PassageDetailContext';
import { prettySegment } from '../../../utils/prettySegment';
import {
  matchesGuidedOutputRow,
  pickLatestGuidedOutputRow,
} from './matchesGuidedOutputRow';
import {
  parseTakeSourceRegion,
  takeMatchesRegion,
} from '../../../crud/phraseTakes';

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
  if (parseTakeSourceRegion(storedSeg)) {
    return takeMatchesRegion(storedSeg, clauseRegion);
  }
  return prettySegment(storedSeg).trim() === prettySegment(clauseRegion).trim();
}

export function getRecordingForClause(
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number,
  clauseRegion: IRegion,
  vernacularMediaId?: string,
  singleSegmentMode?: boolean,
  clauseIndex?: number,
  languageBcp47?: string
): IRow | undefined {
  void sourceVersion;
  const matches = rowData.filter(
    (r) =>
      matchesGuidedOutputRow(r, {
        artifactTypeId: recordTypeId,
        vernacularMediaId,
        languageBcp47,
      }) &&
      regionMatchesClause(
        r.mediafile?.attributes?.sourceSegments,
        clauseRegion,
        { singleSegmentMode, clauseIndex }
      )
  );
  return pickLatestGuidedOutputRow(matches);
}

export function getCompletedClauseIndices(
  clauseRegions: IRegion[],
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number,
  vernacularMediaId?: string,
  singleSegmentMode?: boolean,
  languageBcp47?: string
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
        index,
        languageBcp47
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
