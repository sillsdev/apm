import { useGlobal } from '../context/useGlobal';
import { ArtifactCategory, PassageD, SharedResourceD } from '../model';
import { RecordTransformBuilder } from '@orbit/records';
import { ReplaceRelatedRecord, UpdateRecord } from '../model/baseModel';
import { findRecord, related, useArtifactCategory } from '.';

interface ShResUpdProps {
  onUpdRef?: (id: string, val: string, sr: SharedResourceD) => void;
}

export const useSharedResUpdate = ({ onUpdRef }: ShResUpdProps) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const { localizedArtifactCategory } = useArtifactCategory();

  return async (
    sharedResource: SharedResourceD,
    category: string,
    mediaId?: string
  ) => {
    const t = new RecordTransformBuilder();
    const ops = [
      ...UpdateRecord(t, sharedResource, user),
      ...ReplaceRelatedRecord(
        t,
        sharedResource,
        'artifactCategory',
        'artifactcategory',
        category
      ),
      ...ReplaceRelatedRecord(
        t,
        sharedResource,
        'titleMediafile',
        'mediafile',
        mediaId
      ),
    ];
    let newRef: string | undefined;
    const passageId = related(sharedResource, 'passage');
    const passage = findRecord(memory, 'passage', passageId as string) as
      | PassageD
      | undefined;
    if (sharedResource.attributes.note) {
      const catRec = findRecord(memory, 'artifactcategory', category) as
        | ArtifactCategory
        | undefined;
      newRef = catRec
        ? `NOTE|${localizedArtifactCategory(catRec.attributes?.categoryname)}`
        : 'NOTE';
      if (passage && passage.attributes.reference !== newRef) {
        ops.push(
          ...UpdateRecord(
            t,
            {
              ...passage,
              attributes: { ...passage.attributes, reference: newRef },
            },
            user
          )
        );
      }
    }
    await memory.update(ops);
    if (passageId)
      onUpdRef?.(
        passageId,
        newRef ?? passage?.attributes?.reference ?? '',
        sharedResource
      );
  };
};
