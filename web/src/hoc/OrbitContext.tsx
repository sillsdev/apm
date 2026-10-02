import MemorySource from '@orbit/memory';
import { UninitializedRecord } from '@orbit/records';

type IRecs = UninitializedRecord[] | undefined;

export interface IOrbitContext {
  memory: MemorySource;
  getRecs: (type: string) => IRecs;
  setRecs: (type: string, recs: IRecs) => void;
}
