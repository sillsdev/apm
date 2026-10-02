import { useGlobal } from '../context/useGlobal';
import { ArtifactCategory, SharedResourceD } from '../model';
import { related } from './related';
import { findRecord } from './tryFindRecord';
import { useArtifactCategory } from './useArtifactCategory';

/**
 * Localized category name of a note, read from the shared resource's
 * artifactCategory relationship. That relationship — not the `NOTE|{category}`
 * string cached on the passage reference — is the durable record of which
 * category a note belongs to (TT-7713).
 */
export const useNoteCategory = () => {
  const [memory] = useGlobal('memory');
  const { localizedArtifactCategory } = useArtifactCategory();

  // not memoized (like the sibling useGraphicFind): localizedArtifactCategory
  // closes over the current language strings, and a cached closure would keep
  // showing the old language after a runtime language switch.
  return (sr?: SharedResourceD) => {
    const catId = related(sr, 'artifactCategory');
    if (!catId) return undefined;
    const catRec = findRecord(memory, 'artifactcategory', catId) as
      ArtifactCategory | undefined;
    const slug = catRec?.attributes?.categoryname;
    return slug ? localizedArtifactCategory(slug) : undefined;
  };
};

export default useNoteCategory;
