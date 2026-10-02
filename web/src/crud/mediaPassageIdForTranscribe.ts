import Memory from '@orbit/memory';
import { MediaFile, MediaFileD, PassageD } from '../model';
import related from './related';
import { findRecord } from './tryFindRecord';
import { VernacularTag } from './useArtifactType';

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

/** Media attached to the given passage. Generic so callers holding plain
 * MediaFile[] (e.g. TranscriberContext's planMediaRef) need no cast. */
export function filterMediaForPassage<T extends MediaFile>(
  media: T[],
  passageId: string
): T[] {
  if (!passageId) return [];
  return media.filter((m) => related(m, 'passage') === passageId);
}

/**
 * Latest transcribe tasks for a passage, regardless of which plan owns the
 * media. Linked notes live in a different plan from the source recording.
 */
export function transcribeMediaForPassage(
  mediaFiles: MediaFileD[],
  passageId: string,
  onlyTypeId: string | null | undefined,
  onlyLatest: boolean
): MediaFileD[] {
  if (!passageId) return [];
  let media = mediaFiles.filter(
    (m) => related(m, 'passage') === passageId && m.attributes
  );
  if (onlyTypeId !== undefined) {
    media = media.filter((m) => related(m, 'artifactType') === onlyTypeId);
  }
  if (!onlyLatest) return media;
  if (onlyTypeId === VernacularTag) {
    let latest = 0;
    media.forEach((f) => {
      latest = Math.max(latest, f.attributes.versionNumber);
    });
    return media.filter((f) => f.attributes.versionNumber === latest);
  }
  const vernacularIds = transcribeMediaForPassage(
    mediaFiles,
    passageId,
    VernacularTag,
    true
  ).map((m) => m.id);
  return media.filter(
    (m) => vernacularIds.indexOf(related(m, 'sourceMedia')) >= 0
  );
}
