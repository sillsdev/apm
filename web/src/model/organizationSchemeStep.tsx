import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface OrganizationSchemeStep extends BaseModel {
  attributes: {
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    organizationscheme: RecordRelationship;
    orgWorkflowStep: RecordRelationship;
    user: RecordRelationship;
    group: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrganizationSchemeStepD = Loaded<OrganizationSchemeStep>;

export default OrganizationSchemeStep;
