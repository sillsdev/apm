import { useGlobal } from '../context/useGlobal';
import { Organization } from '../model';
import { findRecords } from './tryFindRecord';

export const useTeamRead = () => {
  const [memory] = useGlobal('memory');

  return (teamId: string) => {
    const teams = findRecords(memory, 'organization');
    const selected = teams.filter((t) => t.id === teamId);
    return selected.length > 0 ? selected[0] : ({} as Organization);
  };
};
