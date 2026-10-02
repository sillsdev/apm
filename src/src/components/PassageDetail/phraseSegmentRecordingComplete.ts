import { IRegion } from '../../crud/useWavesurferRegions';
import { IRow } from '../../context/PassageDetailContext';
import { getCompletedClauseIndices } from './carefulSpeech/carefulSpeechCompletion';

/**
 * True when phrase segments exist on the vernacular media but at least one
 * still lacks a matching Phrase BT / Careful Speech recording.
 */
export function hasIncompletePhraseSegmentRecordings(
  clauseRegions: IRegion[],
  rowData: IRow[],
  artifactTypeId: string,
  sourceVersion: number,
  vernacularMediaId?: string,
  languageBcp47?: string
): boolean {
  if (clauseRegions.length === 0 || !artifactTypeId) return false;
  const completed = getCompletedClauseIndices(
    clauseRegions,
    rowData,
    artifactTypeId,
    sourceVersion,
    vernacularMediaId,
    false,
    languageBcp47
  );
  return completed.size < clauseRegions.length;
}
