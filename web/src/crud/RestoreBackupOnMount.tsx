import { useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import { restoreBackup } from './restoreBackup';
import { isElectron } from '../../api-variable';

/** Loads IndexedDB into memory after first paint so startup is not blocked. */
export function RestoreBackupOnMount() {
  const [coordinator] = useGlobal('coordinator');
  const [, setProjectsLoaded] = useGlobal('projectsLoaded');

  useEffect(() => {
    if (!isElectron || !coordinator) return;
    let cancelled = false;
    restoreBackup(coordinator).then((projects) => {
      if (!cancelled && projects.length > 0) setProjectsLoaded(projects);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator]);

  return null;
}
