import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactCategoryStrings } from '../model';
import { artifactCategorySelector } from '../selector/selectors';

// TODO cleanup: we have a few now of these one line hooks, consolidate/generalize/refactor?
export const useLocalizedArtifactCategory = (): ((val: string) => string) => {
  const t: IArtifactCategoryStrings = useSelector(
    artifactCategorySelector,
    shallowEqual
  );
  // Translate only names that have a string (built-in slugs); show any other
  // (user-defined) name as typed. Otherwise getString alone would read "chapter.1" as a
  // nested path and return "h".
  return (val: string): string =>
    (Object.hasOwn(t, val) && t.getString(val)) || val;
};
