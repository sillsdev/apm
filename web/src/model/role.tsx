import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

//this is currently unused
// role names moved to ./roleNames
export interface Role extends BaseModel {
  attributes: {
    orgRole: boolean;
    groupRole: boolean;
    roleName: string;
    lastModifiedBy: number;
    dateCreated: string;
    dateUpdated: string;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export type RoleD = Loaded<Role>;

export default Role;
