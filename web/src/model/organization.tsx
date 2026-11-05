import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Organization extends BaseModel {
  attributes: {
    name: string;
    slug: string;
    silId: number;
    description: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    publicByDefault: boolean;
    clusterbase: boolean;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    defaultParams: string;
  };
  relationships?: {
    owner: RecordRelationship;
    groups: RecordRelationship;
    cluster: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type OrganizationD = Loaded<Organization>;

export default Organization;
