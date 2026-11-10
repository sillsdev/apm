import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface OrgKeytermReference extends BaseModel {
  attributes: {
    term: string;
    termIndex: number;
    target: string;
    offlineId: string;
    offlineMediafileId: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    orgkeyterm: RecordRelationship;
    project: RecordRelationship;
    section: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrgKeytermReferenceD = Loaded<OrgKeytermReference>;

export default OrgKeytermReference;
