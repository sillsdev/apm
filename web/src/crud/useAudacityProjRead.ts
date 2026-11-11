import { useGlobal } from '../context/useGlobal';
import { AudacityProjectD } from '../model';
import { related } from '.';
import { findRecords } from './tryFindRecord';

export const useAudacityProjRead = () => {
  const [memory] = useGlobal('memory');

  return (passageId: string) => {
    const audacityProjectRecs = findRecords(memory, 'audacityproject');
    const selected = audacityProjectRecs.filter(
      (o) => related(o, 'passage') === passageId
    );
    return selected.length > 0 ? selected[0] : ({} as AudacityProjectD);
  };
};
