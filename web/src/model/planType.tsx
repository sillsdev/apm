import { Loaded, BaseModel } from './baseModel';
import { RecordRelationship } from '@orbit/records';

export interface PlanType extends BaseModel {
  attributes: {
    name: string;
    description: string;
    lastModifiedBy: number;
    dateCreated: string;
    dateUpdated: string;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export type PlanTypeD = Loaded<PlanType>;

export default PlanType;
