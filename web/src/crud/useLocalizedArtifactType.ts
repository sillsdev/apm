import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactTypeStrings } from '../model';
import { artifactTypeSelector } from '../selector/selectors';

export const useLocalizedArtifactType = (): ((val: string) => string) => {
  const t: IArtifactTypeStrings = useSelector(
    artifactTypeSelector,
    shallowEqual
  );
  // Translate only names that have a string (built-in slugs); show any other
  // (user-defined) name as typed. Otherwise getString alone would read "chapter.1" as a
  // nested path and return "h".
  return (val: string): string =>
    (Object.hasOwn(t, val) && t.getString(val)) || val;
};
