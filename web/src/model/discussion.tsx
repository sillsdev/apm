import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Discussion extends BaseModel {
  attributes: {
    subject: string;
    segments: string;
    resolved: boolean;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    offlineId: string;
    offlineMediafileId: string;
  };
  relationships?: {
    mediafile: RecordRelationship;
    group: RecordRelationship;
    user: RecordRelationship;
    artifactCategory: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
    orgWorkflowStep: RecordRelationship;
    creatorUser: RecordRelationship;
  };
}

export type DiscussionD = Loaded<Discussion>;

export default Discussion;
