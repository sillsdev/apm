import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface MediaReplacement extends BaseModel {
  attributes: {
    selectionStart: number;
    selectionEnd: number;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    offlineId: string;
  };
  relationships?: {
    passage: RecordRelationship;
    replacementMediafile: RecordRelationship;
    outputMediafile: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type MediaReplacementD = Loaded<MediaReplacement>;

export default MediaReplacement;
