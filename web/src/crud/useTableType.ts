import { useGlobal } from '../context/useGlobal';
import { Plan, PlanTypeD } from '../model';
import { related } from '.';
import { findRecords } from './tryFindRecord';

export const useTableType = (table: string) => {
  const [memory] = useGlobal('memory');

  return (plan: Plan) => {
    const typeId = related(plan, 'plantype');
    const planTypes = findRecords(memory, `${table}type`) as PlanTypeD[];
    const typeRecs = planTypes.filter((t) => t.id === typeId);
    const planType = typeRecs[0]?.attributes?.name;
    return planType ? planType.toLowerCase() : 'other';
  };
};
