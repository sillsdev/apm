import { PropsWithChildren } from 'react';
import MemorySource from '@orbit/memory';
import { UninitializedRecord } from '@orbit/records';
import { OrbitContext } from './OrbitContextProvider';

interface DataProviderProps extends PropsWithChildren {
  dataStore: MemorySource;
}

type IRecs = UninitializedRecord[] | undefined;

export const DataProvider = ({ dataStore, children }: DataProviderProps) => {
  const recMap = new Map<string, IRecs>();

  const getRecs = (type: string) => recMap.get(type);
  const setRecs = (type: string, recs: IRecs) => recMap.set(type, recs);

  return (
    <OrbitContext.Provider value={{ memory: dataStore, getRecs, setRecs }}>
      {children}
    </OrbitContext.Provider>
  );
};

export default DataProvider;
