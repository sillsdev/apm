import { Loaded } from './baseModel';
import { RecordRelationship, UninitializedRecord } from '@orbit/records';

export interface ProjectType extends UninitializedRecord {
  attributes: {
    name: string;
    description: string | null;
  };
  relationships?: {
    projects: RecordRelationship;
  };
}

export type ProjectTypeD = Loaded<ProjectType>;

export default ProjectType;
