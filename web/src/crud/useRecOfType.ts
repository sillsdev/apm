import { InitializedRecord } from '@orbit/records';
import { useGlobal } from '../context/useGlobal';
import { findRecords } from './tryFindRecord';

export const useRecOfType = () => {
  const [memory] = useGlobal('memory');

  return (recType: string) =>
    (findRecords(memory, recType) as InitializedRecord[])?.filter(
      (r) => r.attributes
    );
};
