import { related } from '../../../crud/related';
import { IRegion } from '../../../crud/useWavesurferRegions';
import { IRow } from '../../../context/PassageDetailContext';
import { prettySegment } from '../../../utils/prettySegment';

export function getRecordingForClause(
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number,
  clauseRegion: IRegion
): IRow | undefined {
  const key = prettySegment(clauseRegion).trim();
  return rowData.find(
    (r) =>
      related(r.mediafile, 'artifactType') === recordTypeId &&
      r.sourceVersion === sourceVersion &&
      prettySegment(r.mediafile?.attributes?.sourceSegments).trim() === key
  );
}

export function getCompletedClauseIndices(
  clauseRegions: IRegion[],
  rowData: IRow[],
  recordTypeId: string,
  sourceVersion: number
): Set<number> {
  const completed = new Set<number>();
  clauseRegions.forEach((region, index) => {
    if (getRecordingForClause(rowData, recordTypeId, sourceVersion, region)) {
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
