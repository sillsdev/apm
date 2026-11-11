import { useGlobal } from '../context/useGlobal';
import {
  RecordIdentity,
  RecordTransformBuilder,
  UninitializedRecord,
} from '@orbit/records';
import { Resource, MediaFile, MediaFileD } from '../model';
import { AddRecord, recordRef, ReplaceRelatedRecord } from '../model/baseModel';
import { ArtifactTypeSlug, useArtifactType } from '.';
import { getContentType } from '../utils/contentType';

export const useMediaResCreate = (passage: RecordIdentity, stepId: string) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [plan] = useGlobal('plan'); //will be constant here
  const { localIdFromSlug } = useArtifactType();

  return async (res: Resource, artifactCategoryId?: string) => {
    const attr = res.attributes;
    const mediaRec = {
      type: 'mediafile',
      attributes: {
        versionNumber: attr.versionNumber,
        eafUrl: null,
        duration: attr.duration,
        contentType: getContentType(attr.contentType, attr.originalFile),
        audioQuality: null,
        textQuality: null,
        transcription: attr.transcription,
        originalFile: attr.originalFile,
        filesize: attr.filesize,
        position: 0,
        segments: '{}',
        languagebcp47: attr.languagebcp47,
        performedBy: null,
        resourcePassageId: attr.passageId,
      },
    } as any as MediaFile;
    const t = new RecordTransformBuilder();
    // AddRecord assigns mediaRec.id, so build the identity after it.
    // TODO cleanup in next PR - guard against wrong ordering in future usages
    const ops = [
      ...AddRecord(t, mediaRec as unknown as UninitializedRecord, user, memory),
    ];
    const mediaRecordIdentity = recordRef('mediafile', mediaRec.id);
    ops.push(
      ...ReplaceRelatedRecord(t, mediaRecordIdentity, 'plan', 'plan', plan),
      ...ReplaceRelatedRecord(
        t,
        mediaRecordIdentity,
        'recordedbyUser',
        'user',
        user
      )
      // shared resources are not associated with a single passage
      // ...ReplaceRelatedRecord(t, mediaRec, 'passage', 'passage', passage.id),
    );
    ops.push(
      ...ReplaceRelatedRecord(
        t,
        mediaRecordIdentity,
        'artifactType',
        'artifacttype',
        localIdFromSlug(ArtifactTypeSlug.SharedResource)
      )
    );
    if (artifactCategoryId)
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          mediaRecordIdentity,
          'artifactCategory',
          'artifactcategory',
          artifactCategoryId
        )
      );
    if (stepId)
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          mediaRecordIdentity,
          'orgWorkflowStep',
          'orgworkflowstep',
          stepId
        )
      );
    await memory.update(ops);
    return mediaRec as MediaFileD;
  };
};
