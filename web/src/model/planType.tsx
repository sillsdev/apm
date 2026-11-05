import { Loaded } from './baseModel';
import { RecordRelationship, UninitializedRecord } from '@orbit/records';

export interface PlanType extends UninitializedRecord {
  attributes: {
    name: string;
    description: string;
  };
  relationships?: {
    plans: RecordRelationship;
  };
}

export type PlanTypeD = Loaded<PlanType>;

export default PlanType;
