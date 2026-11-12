import { related } from '.';
import { ActivityStates, MediaFileD, Passage } from '../model';
import { useOrbitData } from '../hoc/useOrbitData';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';

export const usePassageState = () => {
  const media = useOrbitData<MediaFileD[]>('mediafile');

  return (passage: Passage) => {
    const vernmedia = media
      .filter(
        (m) =>
          related(m, 'passage') === passage.id &&
          related(m, 'artifactType') === null
      )
      .sort(
        (a, b) => b.attributes?.versionNumber - a.attributes?.versionNumber
      );
    if (vernmedia.length === 0) return ActivityStates.NoMedia;
    const pt = passageTypeFromRef(passage.attributes.reference, false);
    if (pt === PassageTypeEnum.CHAPTERNUMBER) return ActivityStates.Done;
    return (
      vernmedia[0].attributes?.transcriptionstate ||
      ActivityStates.TranscribeReady
    );
  };
};
