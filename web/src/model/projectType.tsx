import { Loaded, BaseModel } from './baseModel';
import { RecordRelationship } from '@orbit/records';

export interface ProjectType extends BaseModel {
  attributes: {
    name: string;
    description: string | null;
    lastModifiedBy: number;
    dateCreated: string;
    dateUpdated: string;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export type ProjectTypeD = Loaded<ProjectType>;

export default ProjectType;
