import { shallowEqual, useSelector } from 'react-redux';
import { IRow } from '../../../context/PassageDetailContext';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { passageDetailArtifactsSelector } from '../../../selector';
import { useLocalizedArtifactType } from '../../../crud/useLocalizedArtifactType';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';

export const useRowTypeLabel = () => {
  const localizedArtifactType = useLocalizedArtifactType();
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  return (row: Pick<IRow, 'artifactTypeSlug' | 'isGeneralResource'>): string =>
    // a chunk (derived copy) of a general resource has the plain `resource` type
    // but we want to display "General"; editing the row edits the whole general resource.
    row.isGeneralResource
      ? t.general
      : localizedArtifactType(
          // we changed the label for shared resources to "linked"; reuse the string for "linked"
          // that is already used and translated elsewhere.
          row.artifactTypeSlug === ArtifactTypeSlug.SharedResource
            ? 'linked'
            : row.artifactTypeSlug
        );
};
