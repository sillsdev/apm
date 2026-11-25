import { shallowEqual, useSelector } from 'react-redux';
import { IArtifactCategoryStrings } from '../model';
import { artifactCategorySelector } from '../selector/selectors';

// TODO we have a few now of these one line hooks, consolidate/generalize/refactor?
export const useLocalizedArtifactCategory = (): ((val: string) => string) => {
  const t: IArtifactCategoryStrings = useSelector(
    artifactCategorySelector,
    shallowEqual
  );
  return (val: string): string => t.getString(val, null, true) || val;
};
