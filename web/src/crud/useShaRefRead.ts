import { useGlobal } from '../context/useGlobal';

import related from './related';
import { findRecords } from './tryFindRecord';

export const useShaRefRead = () => {
  const [memory] = useGlobal('memory');

  return (resId: string) => {
    const sharedResourceReferences = findRecords(
      memory,
      'sharedresourcereference'
    );
    const selected = sharedResourceReferences.filter(
      (sr) => related(sr, 'sharedResource') === resId
    );
    return selected;
  };
};
