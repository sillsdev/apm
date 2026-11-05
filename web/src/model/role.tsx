import { Loaded } from './baseModel';
import { RecordRelationship, UninitializedRecord } from '@orbit/records';
// role names moved to ./roleNames
export interface Role extends UninitializedRecord {
  attributes: {
    orgRole: boolean;
    roleName: string;
  };
  relationships?: {
    organization: RecordRelationship;
    users: RecordRelationship;
  };
}

export type RoleD = Loaded<Role>;

export default Role;
