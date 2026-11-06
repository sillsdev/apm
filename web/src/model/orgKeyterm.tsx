import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';
export interface OrgKeyterm extends BaseModel {
  attributes: {
    term: string;
    domain: string;
    definition: string;
    category: string;
    offlineId: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    organization: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrgKeytermD = Loaded<OrgKeyterm>;

export default OrgKeyterm;
