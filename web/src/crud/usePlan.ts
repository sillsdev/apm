import { useGlobal } from '../context/useGlobal';
import { Plan } from '../model';
import { findRecords } from './tryFindRecord';

export const usePlan = () => {
  const [memory] = useGlobal('memory');

  const getPlan = (planId: string) => {
    const plans = findRecords(memory, 'plan');
    const selected = plans.filter((p) => p.id === planId);
    return selected.length > 0 ? selected[0] : null;
  };

  const getPlanName = (planId: string) => {
    const planRec = getPlan(planId);
    return planRec?.attributes?.name || '';
  };

  const getPlanRecName = (plan: Plan) => {
    return plan.attributes ? plan.attributes.name : '';
  };

  return { getPlan, getPlanName, getPlanRecName };
};
