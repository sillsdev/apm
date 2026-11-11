import { useGlobal } from '../context/useGlobal';
import { SectionResourceD } from '../model';
import { related } from '.';
import { findRecords } from './tryFindRecord';

export const useSecResUserRead = () => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');

  return async (resource: SectionResourceD) => {
    const sectionResourceUsers = findRecords(memory, 'sectionresourceuser');
    const rec = sectionResourceUsers.filter(
      (r) =>
        related(r, 'sectionresource') === resource.id &&
        related(r, 'user') === user
    );
    return rec.length > 0 ? rec[0] : null;
  };
};
