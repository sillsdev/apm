import { useMemo } from 'react';
import { ArtifactType } from '../../../model';
import { useGlobal } from '../../../context/useGlobal';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { projectResourceTypeIds } from './generalResourceMedia';

/**
 * Resolve the artifact-type ids the resource flows depend on. Both the edit
 * dialog (PassageDetailArtifacts, for general-resource detection) and the add
 * flow (AddResourceWizard, for creating/cleaning assignments) must resolve the
 * SAME records, gated identically on offlineOnly — if these ever drifted apart
 * a media could be detected as general in one place and written with a
 * different type id in the other. Keeping it here makes that disagreement
 * impossible; findResourceArtifactTypeId is the invariant the tests pin.
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
  // Both projectresource type records (offline + remote); used to resolve
  // general resources for the type label, Edit, and Delete.
  const projResourceTypeIds = useMemo(
    () => projectResourceTypeIds(artifactTypes),
    [artifactTypes]
  );
  return { resourceType, projResourceType, projResourceTypeIds };
}
