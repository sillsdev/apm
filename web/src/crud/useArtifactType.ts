import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { ArtifactType, MediaFile, ArtifactTypeD } from '../model';
import { RecordKeyMap, RecordTransformBuilder } from '@orbit/records';
import { useLocalizedArtifactType } from './useLocalizedArtifactType';
import { findRecords, findRecord } from './tryFindRecord';
import { related } from './related';
import { remoteId, remoteIdGuid } from './remoteId';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import { AddRecord, ReplaceRelatedRecord } from '../model/baseModel';

export const VernacularTag = null; // used to test the relationship

export interface IArtifactType {
  type: string;
  id: string | undefined;
}

export const useArtifactType = (org?: string) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const localizedArtifactType = useLocalizedArtifactType();

  const localizedArtifactTypeFromId = (id: string | null) => {
    return localizedArtifactType(
      id ? slugFromId(id) : ArtifactTypeSlug.Vernacular
    );
  };

  const slugFromId = (id: string | null) => {
    if (!id) return ArtifactTypeSlug.Vernacular;
    const guid =
      remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id;
    const at = findRecord(memory, 'artifacttype', guid) as ArtifactType;
    return (
      (at?.attributes?.typename as ArtifactTypeSlug) ??
      ArtifactTypeSlug.Vernacular
    );
  };

  const getArtifactTypes = (
    limit?: ArtifactTypeSlug[],
    remoteIds: boolean = false
  ) => {
    const types: IArtifactType[] = [];
    if (!limit || limit.includes(ArtifactTypeSlug.Vernacular))
      types.push({
        type: localizedArtifactType(ArtifactTypeSlug.Vernacular),
        id: undefined,
      });
    const artifacts: ArtifactTypeD[] = findRecords(memory, 'artifacttype');
    artifacts
      .filter(
        (r) =>
          (!r.relationships ||
            (Boolean(r.relationships) &&
              (related(r, 'organization') === (org ?? organization) ||
                related(r, 'organization') === null))) &&
          Boolean(r.keys?.remoteId) !== offlineOnly
      )
      .sort((i, j) =>
        localizedArtifactType(i.attributes.typename) <
        localizedArtifactType(j.attributes.typename)
          ? -1
          : 1
      )
      .forEach((r) => {
        if (!limit || limit.includes(r.attributes.typename as ArtifactTypeSlug))
          types.push({
            type: localizedArtifactType(r.attributes.typename),
            id:
              remoteIds && !offlineOnly
                ? remoteId('artifacttype', r.id, memory?.keyMap as RecordKeyMap)
                : r.id,
          });
      });
    return types;
  };

  const IsVernacularMedia = (m: MediaFile) => {
    return related(m, 'artifactType') === VernacularTag;
  };

  const getTypeId = (typeSlug: string, forceOffline: boolean = false) => {
    if (typeSlug === ArtifactTypeSlug.Vernacular) return null;
    const types = memory?.cache.query((q) =>
      q
        .findRecords('artifacttype')
        .filter({ attribute: 'typename', value: typeSlug })
    ) as ArtifactType[];
    const v = types?.find(
      (r) => Boolean(r?.keys?.remoteId) !== (forceOffline || offlineOnly)
    );
    return v?.id || '';
  };

  const commentId = useMemo(() => {
    return getTypeId(ArtifactTypeSlug.Comment) as string;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineOnly]);

  const keyTermId = useMemo(() => {
    return getTypeId(ArtifactTypeSlug.KeyTerm) as string;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineOnly]);

  const addNewArtifactType = async (newArtifactType: string) => {
    const artifactType: ArtifactTypeD = {
      type: 'artifacttype',
      attributes: {
        typename: newArtifactType,
      },
    } as any;
    const t = new RecordTransformBuilder();
    await memory.update([
      ...AddRecord(t, artifactType, user, memory),
      ...ReplaceRelatedRecord(
        t,
        artifactType,
        'organization',
        'organization',
        org ?? organization
      ),
    ]);
  };
  return {
    getArtifactTypes,
    addNewArtifactType,
    localizedArtifactType,
    slugFromId,
    localizedArtifactTypeFromId,
    commentId,
    keyTermId,
    getTypeId,
    IsVernacularMedia,
  };
};
