import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface OrganizationBible extends BaseModel {
  attributes: {
    ownerorg: boolean;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    bible: RecordRelationship;
    organization: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrganizationBibleD = Loaded<OrganizationBible>;

export default OrganizationBible;
