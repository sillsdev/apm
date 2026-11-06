import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface ArtifactCategory extends BaseModel {
  attributes: {
    categoryname: string;
    discussion: boolean;
    resource: boolean;
    note: boolean;
    color: string;
    specialuse: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    titleMediafile: RecordRelationship;
    organization: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type ArtifactCategoryD = Loaded<ArtifactCategory>;

export default ArtifactCategory;
