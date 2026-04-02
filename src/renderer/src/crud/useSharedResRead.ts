import { useCallback } from 'react';
import { useGlobal } from '../context/useGlobal';
import { PassageD, SharedResourceD } from '../model';
import related from './related';
import { findRecord } from './tryFindRecord';

export const useSharedResRead = () => {
  const [memory] = useGlobal('memory');

  const readSharedResource = useCallback((passId: string) => {
    const sharedResources = memory?.cache.query((q) =>
      q.findRecords('sharedresource')
    ) as SharedResourceD[];
    const selected = sharedResources.filter(
      (sr) => related(sr, 'passage') === passId
    );
    return selected.length > 0 ? selected[0] : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSharedResource = useCallback(
    (p: PassageD) => {
      const linkedRes = related(p, 'sharedResource');
      if (linkedRes)
        return findRecord(
          memory,
          'sharedresource',
          linkedRes
        ) as SharedResourceD;
      return readSharedResource(p.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readSharedResource]
  );

  return { getSharedResource, readSharedResource };
};
