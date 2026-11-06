import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface SectionResourceUser extends BaseModel {
  attributes: {
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    offlineId: string;
  };
  relationships?: {
    sectionresource: RecordRelationship;
    user: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type SectionResourceUserD = Loaded<SectionResourceUser>;

export default SectionResourceUser;
