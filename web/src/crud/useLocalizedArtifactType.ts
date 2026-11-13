import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactTypeStrings, IState } from '../model';
import localStrings from '../selector/localize';

const stringSelector = (state: IState) =>
  localStrings(state, { layout: 'artifactType' });

export const useLocalizedArtifactType = () => {
  const t: IArtifactTypeStrings = useSelector(stringSelector, shallowEqual);
  return (val: string): string =>
    (t as unknown as Record<string, string | undefined>)[val] || val;
};
