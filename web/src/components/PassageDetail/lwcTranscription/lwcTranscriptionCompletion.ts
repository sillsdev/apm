import { IRow } from '../../../context/PassageDetailContext';
import { IRegion } from '../../../crud/useWavesurferRegions';
import {
  firstIncompleteClauseIndex,
  getRecordingForClause,
} from '../carefulSpeech/carefulSpeechCompletion';

export { firstIncompleteClauseIndex };

export function isClauseTranscribed(row: IRow | undefined): boolean {
  const text = row?.mediafile?.attributes?.transcription;
  return typeof text === 'string' && text.trim().length > 0;
}

export function getTranscribedClauseIndices(
  clauseRegions: IRegion[],
  rowData: IRow[],
  lwcArtifactTypeId: string,
  sourceVersion: number,
  vernacularMediaId?: string
): Set<number> {
  const completed = new Set<number>();
  clauseRegions.forEach((region, index) => {
    const row = getRecordingForClause(
      rowData,
      lwcArtifactTypeId,
      sourceVersion,
      region,
      vernacularMediaId
    );
    if (isClauseTranscribed(row)) {
      completed.add(index);
    }
  });
  return completed;
}

export function getLwcRecordingRowForClause(
  rowData: IRow[],
  lwcArtifactTypeId: string,
  sourceVersion: number,
  clauseRegion: IRegion,
  vernacularMediaId?: string
): IRow | undefined {
  return getRecordingForClause(
    rowData,
    lwcArtifactTypeId,
    sourceVersion,
    clauseRegion,
    vernacularMediaId
  );
}
