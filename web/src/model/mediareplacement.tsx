import { InitializedRecord, RecordRelationship } from '@orbit/records';
import { BaseModel } from './baseModel';

export interface MediaReplacement extends BaseModel {
  attributes: {
    selectionStart: number;
    selectionEnd: number;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    plan: RecordRelationship;
    replacementMediafile: RecordRelationship;
    outputMediafile: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type MediaReplacementD = MediaReplacement & InitializedRecord;

export default MediaReplacement;
