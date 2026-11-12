import { useGlobal } from '../context/useGlobal';
import { SharedResourceReferenceD } from '../model';
import { RecordOperation, RecordTransformBuilder } from '@orbit/records';

export const useShaRefDelete = () => {
  const [memory] = useGlobal('memory');

  return async (shaRefRecs: SharedResourceReferenceD[]) => {
    const t = new RecordTransformBuilder();
    const ops: RecordOperation[] = [];
    for (const shaRefRec of shaRefRecs) {
      ops.push(t.removeRecord(shaRefRec).toOperation());
    }
    await memory.update(ops);
  };
};
