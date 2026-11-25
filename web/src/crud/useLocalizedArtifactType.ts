import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactTypeStrings } from '../model';
import { artifactTypeSelector } from '../selector/selectors';

export const useLocalizedArtifactType = (): ((val: string) => string) => {
  const t: IArtifactTypeStrings = useSelector(
    artifactTypeSelector,
    shallowEqual
  );
  return (val: string): string => t.getString(val, null, true) || val;
};
