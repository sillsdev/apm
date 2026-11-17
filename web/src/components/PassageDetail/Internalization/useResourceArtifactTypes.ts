import { useMemo } from 'react';
import { ArtifactType } from '../../../model';
import { useGlobal } from '../../../context/useGlobal';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { projectResourceTypeIds } from './generalResourceMedia';

/**
 * Resolve the artifact-type ids the resource flows depend on. Used by both the edit
 * dialog (PassageDetailArtifacts, for general-resource detection) and the add
 * flow (AddResourceWizard, for creating/cleaning assignments) as they must resolve the
 * SAME records
 */
export const findResourceArtifactTypeId = (
  artifactTypes: ArtifactType[],
  typename: 'resource' | 'projectresource',
  offlineOnly: boolean
): string | undefined =>
  artifactTypes.find(
    (t) =>
      t.attributes?.typename === typename &&
      Boolean(t?.keys?.remoteId) === !offlineOnly
  )?.id;

export function useResourceArtifactTypes() {
  const artifactTypes = useOrbitData<ArtifactType[]>('artifacttype');
  const [offlineOnly] = useGlobal('offlineOnly');
  const resourceType = useMemo(
    () => findResourceArtifactTypeId(artifactTypes, 'resource', offlineOnly),
    [artifactTypes, offlineOnly]
  );
  const projResourceType = useMemo(
    () =>
      findResourceArtifactTypeId(artifactTypes, 'projectresource', offlineOnly),
    [artifactTypes, offlineOnly]
  );
  const projResourceTypeIds = useMemo(
    () => projectResourceTypeIds(artifactTypes),
    [artifactTypes]
  );
  return { resourceType, projResourceType, projResourceTypeIds };
}
