import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface OrganizationScheme extends BaseModel {
  attributes: {
    name: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    organization: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrganizationSchemeD = Loaded<OrganizationScheme>;

export default OrganizationScheme;
