import Memory from '@orbit/memory';
import { MediaFileD, PassageD } from '../model';
import related from './related';
import { findRecord } from './tryFindRecord';

/** Passage id whose media Transcribe should list. Linked notes share the source. */
export function mediaPassageIdForTranscribe(
  passage: PassageD | undefined | null,
  memory?: Memory
): string {
  if (!passage?.id) return '';
  const srId = related(passage, 'sharedResource');
  if (typeof srId === 'string' && srId) {
    const sr = findRecord(memory as Memory, 'sharedresource', srId);
    const sourceId = related(sr, 'passage');
    if (typeof sourceId === 'string' && sourceId) return sourceId;
  }
  return passage.id;
}

export function filterMediaForPassage(
  media: MediaFileD[],
  passageId: string
): MediaFileD[] {
  if (!passageId) return [];
  return media.filter((m) => related(m, 'passage') === passageId);
}
