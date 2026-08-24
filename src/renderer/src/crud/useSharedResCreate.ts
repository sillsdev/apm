import { useGlobal } from '../context/useGlobal';
import { RecordIdentity, RecordTransformBuilder } from '@orbit/records';
import {
  ArtifactCategory,
  PassageD,
  SharedResource,
  SharedResourceD,
} from '../model';
import {
  AddRecord,
  ReplaceRelatedRecord,
  UpdateRecord,
} from '../model/baseModel';
import { findRecord } from './tryFindRecord';
import { useArtifactCategory } from '.';

interface IProps {
  title: string;
  mediaId?: string;
  description: string;
  languagebcp47: string;
  termsOfUse: string;
  keywords: string;
  linkurl: string;
  note: boolean;
  category: string;
}

interface RefProps {
  passage: RecordIdentity;
  cluster?: RecordIdentity;
  onUpdRef?: (id: string, val: string, sr: SharedResourceD) => void;
}

export const useSharedResCreate = ({
  passage,
  cluster,
  onUpdRef,
}: RefProps) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const { localizedArtifactCategory } = useArtifactCategory();

  return async ({
    title,
    mediaId,
    description,
    languagebcp47,
    termsOfUse,
    keywords,
    category, // id of artifactCateogy
    linkurl,
    note,
  }: IProps) => {
    const sharedRes: SharedResource = {
      type: 'sharedresource',
      attributes: {
        title,
        description,
        languagebcp47,
        termsOfUse,
        keywords,
        linkurl,
        note,
      },
    } as SharedResource;
    const t = new RecordTransformBuilder();
    const ops = [
      ...AddRecord(t, sharedRes, user, memory),
      ...ReplaceRelatedRecord(
        t,
        sharedRes as RecordIdentity,
        'passage',
        'passage',
        passage.id
      ),
    ];
    if (cluster) {
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          sharedRes as RecordIdentity,
          'cluster',
          'organization',
          cluster.id
        )
      );
    }
    if (category) {
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          sharedRes as RecordIdentity,
          'artifactCategory',
          'artifactcategory',
          category
        )
      );
    }
    if (mediaId) {
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          sharedRes as RecordIdentity,
          'titleMediafile',
          'mediafile',
          mediaId
        )
      );
    }

    let newRef: string | undefined;
    const passRec = findRecord(memory, 'passage', passage.id) as
      | PassageD
      | undefined;
    if (note && category) {
      const catRec = findRecord(memory, 'artifactcategory', category) as
        | ArtifactCategory
        | undefined;
      if (catRec) {
        newRef = `NOTE|${localizedArtifactCategory(
          catRec.attributes?.categoryname
        )}`;
        if (passRec && passRec.attributes.reference !== newRef) {
          ops.push(
            ...UpdateRecord(
              t,
              {
                ...passRec,
                attributes: { ...passRec.attributes, reference: newRef },
              },
              user
            )
          );
        }
      }
    }

    await memory.update(ops);
    onUpdRef?.(
      passage.id,
      newRef ?? passRec?.attributes?.reference ?? '',
      sharedRes as SharedResourceD
    );
  };
};
