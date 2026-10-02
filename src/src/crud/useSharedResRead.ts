import { useCallback } from 'react';
import { useGlobal } from '../context/useGlobal';
import { PassageD, SharedResourceD } from '../model';
import related from './related';
import { findRecord } from './tryFindRecord';

/** One pass over the shared-resource cache. getSheet used to re-query it per passage. */
export const lookupSharedResource = (
  sharedResources: readonly SharedResourceD[]
) => {
  const byId = new Map<string, SharedResourceD>();
  const byPassage = new Map<string, SharedResourceD>();
  for (const sr of sharedResources) {
    byId.set(sr.id, sr);
    const passageId = related(sr, 'passage');
    if (passageId && !byPassage.has(passageId)) byPassage.set(passageId, sr);
  }
  return (p: PassageD): SharedResourceD | undefined => {
    const linked = related(p, 'sharedResource');
    if (linked) return byId.get(linked);
    return byPassage.get(p.id);
  };
};

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
