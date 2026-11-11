import { useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import {
  IState,
  IArtifactTypeStrings,
  ArtifactType,
  MediaFile,
  ArtifactTypeD,
} from '../model';
import { RecordKeyMap } from '@orbit/records';
import localStrings from '../selector/localize';
import { useSelector, shallowEqual } from 'react-redux';
import { findRecords, findRecord } from './tryFindRecord';
import { related } from './related';
import { remoteIdGuid, remoteIdNum } from './remoteId';
import { ArtifactTypeSlug, isArtifactTypeSlug } from './artifactTypeSlug';

export const VernacularTag = null; // used to test the relationship

interface ISwitches {
  [key: string]: any;
}
export interface IArtifactType {
  type: string;
  id: string | undefined;
  slug: ArtifactTypeSlug;
}
const stringSelector = (state: IState) =>
  localStrings(state as IState, { layout: 'artifactType' });

export const useArtifactType = (org?: string) => {
  const [memory] = useGlobal('memory');
  const [organization] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const t: IArtifactTypeStrings = useSelector(stringSelector, shallowEqual);
  const [fromLocal] = useState<ISwitches>({});

  const localizedArtifactType = (val: string) => {
    return (t as ISwitches)[val] || val;
  };
  const localizedArtifactTypeFromId = (id: string | null) => {
    return localizedArtifactType(
      id ? slugFromId(id) : ArtifactTypeSlug.Vernacular
    );
  };

  /**
   * The slug for an artifact type given as a local id, a remote id, or a slug.
   * Slugs pass through: step settings and props now carry slugs, but persisted
   * data may still hold a remote/local id.
   */
  const slugFromId = (id: string | null) => {
    if (!id) return ArtifactTypeSlug.Vernacular;
    if (isArtifactTypeSlug(id)) return id;
    const guid =
      remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id;
    const at = findRecord(memory, 'artifacttype', guid) as ArtifactType;
    return (
      (at?.attributes?.typename as ArtifactTypeSlug) ??
      ArtifactTypeSlug.Vernacular
    );
  };

  const fromLocalizedArtifactType = (val: string) => {
    if (Object.entries(fromLocal).length === 0) {
      for (const [key, value] of Object.entries(t)) {
        fromLocal[value] = key;
      }
    }
    return fromLocal[val] || val;
  };

  const getArtifactTypes = (limit?: ArtifactTypeSlug[]) => {
    const types: IArtifactType[] = [];
    if (!limit || limit.includes(ArtifactTypeSlug.Vernacular))
      types.push({
        type: localizedArtifactType(ArtifactTypeSlug.Vernacular),
        id: undefined,
        slug: ArtifactTypeSlug.Vernacular,
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
            id: r.id,
            slug: r.attributes.typename as ArtifactTypeSlug,
          });
      });
    return types;
  };

  const IsVernacularMedia = (m: MediaFile) => {
    return related(m, 'artifactType') === VernacularTag;
  };

  /**
   * The local Orbit id for an artifact-type slug: `null` for Vernacular (which
   * has no artifact type record — see `VernacularTag`), `''` for an unknown
   * slug. Takes a slug only — an id passed here will not match; use
   * {@link localIdFromIdOrSlug} for values read from step settings.
   */
  const localIdFromSlug = (
    typeSlug: string | null,
    forceOffline: boolean = false
  ) => {
    if (typeSlug === ArtifactTypeSlug.Vernacular || typeSlug === null)
      return null;
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

  /**
   * The local Orbit id for an artifact type stored in step settings, which may
   * hold a slug (current format) or a remote/local id (legacy). `null` when
   * unset or Vernacular.
   */
  const localIdFromIdOrSlug = (value: string | null | undefined) => {
    if (!value) return null;
    if (isArtifactTypeSlug(value)) return localIdFromSlug(value);
    return (
      remoteIdGuid('artifacttype', value, memory?.keyMap as RecordKeyMap) ??
      value
    );
  };

  /**
   * The remote id for an artifact-type slug, as the number the API expects, or
   * undefined when there is none — Vernacular (no artifact type record), an
   * unknown slug, or a record that has not been synced yet. Use at the API
   * boundary; prefer the slug locally.
   */
  const remoteIdNumFromSlug = (
    typeSlug: string | null,
    forceOffline: boolean = false
  ) => {
    const localId = localIdFromSlug(typeSlug, forceOffline);
    if (!localId) return undefined;
    const num = remoteIdNum(
      'artifacttype',
      localId,
      memory?.keyMap as RecordKeyMap
    );
    return isNaN(num) ? undefined : num;
  };

  return {
    getArtifactTypes,
    localizedArtifactType,
    slugFromId,
    localizedArtifactTypeFromId,
    fromLocalizedArtifactType,
    localIdFromSlug,
    localIdFromIdOrSlug,
    remoteIdNumFromSlug,
    IsVernacularMedia,
  };
};
