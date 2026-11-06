import { useGlobal } from '../context/useGlobal';
import { Group } from '../model';
import { related } from '.';
import { findRecords } from './tryFindRecord';

export const useAllUserGroup = () => {
  const [memory] = useGlobal('memory');

  return (teamId: string) => {
    const groups = findRecords(memory, 'group');
    const selected = groups.filter(
      (g) => related(g, 'owner') === teamId && g?.attributes?.allUsers
    );
    return selected.length > 0 ? selected[0] : ({} as Group);
  };
};
