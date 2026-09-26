import { PropsWithChildren, useRef } from 'react';
import MemorySource from '@orbit/memory';
import { UninitializedRecord } from '@orbit/records';
import { OrbitContext } from './OrbitContextProvider';

interface DataProviderProps extends PropsWithChildren {
  dataStore: MemorySource;
}

type IRecs = UninitializedRecord[] | undefined;

export const DataProvider = ({ dataStore, children }: DataProviderProps) => {
  // Keep the cache stable across DataProvider re-renders. A fresh `new Map()`
  // per render would silently drop every cached record set.
  const recMap = useRef(new Map<string, IRecs>()).current;

  const getRecs = (type: string) => recMap.get(type);
  const setRecs = (type: string, recs: IRecs) => recMap.set(type, recs);

  return (
    <OrbitContext.Provider value={{ memory: dataStore, getRecs, setRecs }}>
      {children}
    </OrbitContext.Provider>
  );
};

export default DataProvider;
