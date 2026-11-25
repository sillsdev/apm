import Memory from '@orbit/memory';
import { findRecord } from './tryFindRecord';
import { mediaFileName } from './media';
import { related } from './related';
import {
  PassageStateChange,
  ActivityStates,
  Passage,
  MediaFileD,
} from '../model';
import {
  AddRecord,
  recordRef,
  ReplaceRelatedRecord,
  UpdateLastModifiedBy,
} from '../model/baseModel';
import {
  RecordIdentity,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';

export const AddPassageStateChangeToOps = (
  t: RecordTransformBuilder,
  ops: RecordOperation[],
  passage: string,
  state: string,
  comment: string,
  userId: string,
  memory: Memory
) => {
  const psc = {
    type: 'passagestatechange',
    attributes: {
      state: state,
      comments: comment,
    },
  } as PassageStateChange;
  ops.push(
    ...AddRecord(t, psc, userId, memory),
    ...ReplaceRelatedRecord(t, psc, 'passage', 'passage', passage)
  );
};

export const AddFlatPassage = (
  rec: Passage,
  section: RecordIdentity,
  planid: string,
  media: { type: 'mediafile'; id: string },
  userId: string,
  memory: Memory
): RecordOperation[] => {
  const t = new RecordTransformBuilder();
  const ops: RecordOperation[] = [];
  ops.push(
    ...AddRecord(t, rec, userId, memory),
    ...ReplaceRelatedRecord(t, rec, 'section', 'section', section.id)
  );
  AddPassageStateChangeToOps(
    t,
    ops,
    rec.id as string,
    ActivityStates.TranscribeReady,
    '',
    userId,
    memory
  );
  ops.push(...ReplaceRelatedRecord(t, media, 'passage', 'passage', rec.id));
  return ops;
};

export const UpdateRelatedPassageOps = (
  section: string,
  plan: string,
  userId: string,
  t: RecordTransformBuilder,
  ops: RecordOperation[]
) => {
  ops.push(
    ...UpdateLastModifiedBy(t, { type: 'section', id: section }, userId),
    ...UpdateLastModifiedBy(t, { type: 'plan', id: plan }, userId)
  );
};
export const UpdateMediaStateOps = (
  mediafile: string,
  passage: string,
  state: string,
  userId: string,
  t: RecordTransformBuilder,
  ops: RecordOperation[],
  memory: Memory,
  comment: string
): RecordOperation[] => {
  // Identity ops only need the id. Attributes come from the cache when present.
  const mediaRef = recordRef('mediafile', mediafile);
  const mediaRec = findRecord(memory, 'mediafile', mediafile) as
    MediaFileD | undefined;
  if (state)
    ops.push(
      t.replaceAttribute(mediaRef, 'transcriptionstate', state).toOperation()
    );
  const isVernacular = !related(mediaRec, 'artifactType');
  ops.push(...UpdateLastModifiedBy(t, mediaRef, userId));
  AddPassageStateChangeToOps(
    t,
    ops,
    passage,
    isVernacular && state ? state : '',
    mediaFileName(mediaRec) + (comment ? ':' + comment : ''),
    userId,
    memory
  );
  return ops;
};
