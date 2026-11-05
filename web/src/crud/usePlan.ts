import { useGlobal } from '../context/useGlobal';
import { Plan, PlanD } from '../model';

export const usePlan = () => {
  const [memory] = useGlobal('memory');

  const getPlan = (planId: string) => {
    const plans = memory?.cache.query((q) => q.findRecords('plan')) as PlanD[];
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
