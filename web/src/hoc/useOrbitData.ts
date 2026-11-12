import { useContext, useState, useEffect, useCallback } from 'react';
import { OrbitContext } from './OrbitContextProvider';
import { UninitializedRecord } from '@orbit/records';
import { useRenderProfiler, perfRecordGlobalSet } from '../utils/perf';

// Stable empty result used before the memory source is available, so we don't
// hand back a fresh array identity on every render.
const EMPTY: UninitializedRecord[] = [];

/**
 * Subscribe a component to the live set of Orbit records for `model`.
 *
 * Design notes (this hook has been a source of subtle bugs):
 *
 * - One subscription per mount, established in a useEffect and cleaned up on
 *   unmount. The original implementation subscribed *during render* and never
 *   unsubscribed the prior subscription, so every data change fired an
 *   ever-growing pile of callbacks — each triggering another render + another
 *   subscription — a self-amplifying render storm.
 *
 * - Data is read with `memory.cache.query` (the canonical synchronous read used
 *   throughout the codebase), NOT `liveQuery.query()`, which returns the live
 *   query's own internal snapshot and is stale until re-evaluated. The
 *   liveQuery is used purely as a change signal.
 *
 * - A catch-up read runs immediately after subscribing. Records can finish
 *   loading (e.g. a backup restore from IndexedDB) in the window between the
 *   first render and the effect wiring up the subscription; without the
 *   catch-up the component would keep showing the empty initial snapshot and
 *   never update (which left teams/projects blank on some loads).
 *
 * Reference stability: `records` state only changes when the subscription fires
 * (an actual data change) or on the one-time mount catch-up, so consumers that
 * use the result in useMemo/useEffect deps see a stable array between changes.
 */
export function useOrbitData<S extends UninitializedRecord[]>(
  model: string
): S {
  useRenderProfiler(`useOrbitData:${model}`);
  const { memory } = useContext(OrbitContext);

  const read = useCallback(
    (): S =>
      memory
        ? (memory.cache.query((q) => q.findRecords(model)) as S)
        : (EMPTY as S),
    [memory, model]
  );

  const [records, setRecords] = useState<S>(read);

  useEffect(() => {
    if (!memory) return;
    const liveQuery = memory.cache.liveQuery((q) => q.findRecords(model));
    const unsubscribe = liveQuery.subscribe(() => {
      perfRecordGlobalSet(`orbitUpdate:${model}`); // data-driven refresh
      setRecords(read());
    });
    // Catch up on anything that changed between the initial render and here.
    setRecords(read());
    return unsubscribe;
  }, [memory, model, read]);

  return records;
}
