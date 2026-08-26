import type Memory from '@orbit/memory';
import {
  RecordIdentity,
  RecordKeyMap,
  UninitializedRecord,
} from '@orbit/records';
import IntellectualProperty from '../model/intellectualProperty';
import { MediaFileD } from '../model';
import { AddRecord, ReplaceRelatedRecord } from '../model/baseModel';
import { findRecord } from './tryFindRecord';
import { remoteIdGuid } from './remoteId';

export interface CreateIntellectualPropertyForMediaParams {
  memory: Memory;
  user: string;
  mediaId: string;
  rightsHolder: string;
  organizationId: string;
  notes?: string;
  transcription?: string;
  applyTranscription?: (
    media: MediaFileD,
    transcription: string
  ) => void | Promise<void>;
}

export async function createIntellectualPropertyForMedia({
  memory,
  user,
  mediaId,
  rightsHolder,
  organizationId,
  notes,
  transcription,
  applyTranscription,
}: CreateIntellectualPropertyForMediaParams): Promise<void> {
  const id =
    remoteIdGuid('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ??
    mediaId;
  if (transcription && applyTranscription) {
    const mediaRec = findRecord(memory, 'mediafile', id) as
      | MediaFileD
      | undefined;
    if (mediaRec) {
      await applyTranscription(mediaRec, transcription);
    }
  }
  const ip = {
    type: 'intellectualproperty',
    attributes: {
      rightsHolder,
      notes: notes ?? '{}',
    },
  } as IntellectualProperty & UninitializedRecord;
  await memory.update((t) => [
    ...AddRecord(t, ip, user, memory),
    ...ReplaceRelatedRecord(
      t,
      ip as RecordIdentity,
      'releaseMediafile',
      'mediafile',
      id
    ),
    ...ReplaceRelatedRecord(
      t,
      ip as RecordIdentity,
      'organization',
      'organization',
      organizationId
    ),
  ]);
}
