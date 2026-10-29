import { useGlobal } from '../context/useGlobal';
import IndexedDBSource from '@orbit/indexeddb';
import { deleteOfflineProjects } from './offlineProjectDelete';

export const useOfflnProjDelete = () => {
  const [memory] = useGlobal('memory');
  const [coordinator] = useGlobal('coordinator');

  return async (projectId: string) => {
    const backup = coordinator?.getSource('backup') as IndexedDBSource;
    await deleteOfflineProjects(memory, backup, [projectId]);
  };
};
