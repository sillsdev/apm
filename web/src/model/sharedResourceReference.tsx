import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface SharedResourceReference extends BaseModel {
  attributes: {
    book: string;
    chapter: number;
    verse: number; //or maybe this isn't here at all?
    verses: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships: {
    sharedResource: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type SharedResourceReferenceD = Loaded<SharedResourceReference>;

export default SharedResourceReference;
