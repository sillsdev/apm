import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface AudacityProject extends BaseModel {
  attributes: {
    audacityName: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    passage: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type AudacityProjectD = Loaded<AudacityProject>;

export default AudacityProject;
