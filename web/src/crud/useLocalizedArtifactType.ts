import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactTypeStrings } from '../model';
import { artifactTypeSelector } from '../selector/selectors';

export const useLocalizedArtifactType = () => {
  const t: IArtifactTypeStrings = useSelector(
    artifactTypeSelector,
    shallowEqual
  );
  return (val: string): string => {
    // Guard against LocalizedStrings' own members (e.g. getString) and fall
    // back to the slug for missing or empty strings.
    const label: unknown = (t as unknown as Record<string, unknown>)[val];
    return typeof label === 'string' && label ? label : val;
  };
};
