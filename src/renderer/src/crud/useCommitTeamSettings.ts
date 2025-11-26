import { ITeamDialog } from '../components/Team/TeamDialog';
import { useBible } from './useBible';
import { TeamContext } from '../context/TeamContext';
import { useContext } from 'react';

export const useCommitTeamSettings = () => {
  const { createBible, updateBible } = useBible();
  const ctx = useContext(TeamContext);
  const { teamUpdate, resetProjectPermissions } = ctx?.state ?? {};

  return async (values: ITeamDialog, cb?: (id: string) => Promise<void>) => {
    if (values.bible)
      if (!values.bible.id) {
        await createBible(
          values.bible,
          values.bibleMediafile,
          values.isoMediafile,
          values.team.id
        );
      } else
        await updateBible(
          values.bible,
          values.bibleMediafile,
          values.isoMediafile,
          values.team.id
        );

    if (typeof teamUpdate === 'function') {
      teamUpdate(values.team);
    }
    if (values.resetProjectPermissions)
      await resetProjectPermissions(values.team.id);
    cb && (await cb(values.team.id));
  };
};
