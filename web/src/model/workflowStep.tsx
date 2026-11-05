import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface WorkflowStep extends BaseModel {
  attributes: {
    process: string;
    name: string;
    sequencenum: number;
    tool: string;
    permissions: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export type WorkflowStepD = Loaded<WorkflowStep>;

export default WorkflowStep;
