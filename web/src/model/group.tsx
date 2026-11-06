import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Group extends BaseModel {
  attributes: {
    name: string;
    abbreviation: string;
    ownerId: number;
    permissions: string;
    allUsers: boolean;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    owner: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type GroupD = Loaded<Group>;

export default Group;
