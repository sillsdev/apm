import { useGlobal } from '../context/useGlobal';

import { related } from '.';
import { findRecords } from './tryFindRecord';

export const useProjectPlans = () => {
  const [memory] = useGlobal('memory');

  return (projectId: string) => {
    const plans = findRecords(memory, 'plan');
    return plans.filter((p) => related(p, 'project') === projectId);
  };
};
