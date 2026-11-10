import { useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { passageDetailArtifactsSelector } from '../../../selector';
import { useOrganizedBy } from '../../../crud';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import {
  sectionResourceDesc,
  passageResourceDesc,
} from './resourceScopeLabels';

/**
 * The display labels for a resource's section/passage scope, shared by the edit
 * dialog (PassageDetailArtifacts) and the add flow (AddResourceWizard)
 */
export function useResourceScopeLabels() {
  const { section, passage } = usePassageDetailContext();
  const { getOrganizedBy } = useOrganizedBy();
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const sectDesc = useMemo(
    () => sectionResourceDesc(section, t, getOrganizedBy(true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section]
  );
  const passDesc = useMemo(
    () => passageResourceDesc(passage, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passage]
  );
  return { sectDesc, passDesc };
}
