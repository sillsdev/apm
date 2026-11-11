import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Bible extends BaseModel {
  attributes: {
    bibleId: string;
    bibleName: string;
    iso: string;
    publishingData: string;
    anyPublished: boolean;
    //abbr: string;
    description: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    isoMediafile: RecordRelationship;
    bibleMediafile: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type BibleD = Loaded<Bible>;

export default Bible;
