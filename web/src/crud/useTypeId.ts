import { useGlobal } from '../context/useGlobal';
import { InitializedRecord } from '@orbit/records';
import { findRecords } from './tryFindRecord';

export const useTypeId = () => {
  const [memory] = useGlobal('memory');
  const [isOfflineOnly] = useGlobal('offlineOnly'); //will be constant here

  return (type: string, table: string) => {
    const ptRecs = findRecords(memory, `${table}type`) as InitializedRecord[];
    const selected = ptRecs.filter(
      (p) =>
        (p?.attributes?.name as string)?.toLowerCase() === type.toLowerCase() &&
        Boolean(p?.keys?.remoteId) !== isOfflineOnly
    );
    return selected.length > 0 ? selected[0].id : '';
  };
};
