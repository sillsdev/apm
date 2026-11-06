import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Passage extends BaseModel {
  attributes: {
    sequencenum: number;
    book: string;
    reference: string;
    state: string; //backwardcompatibility only
    hold: boolean;
    title: string;
    lastComment: string;
    stepComplete: string; //json
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    startChapter?: number; //calculated in online db
    endChapter?: number; //calculated
    startVerse?: number; //calculated
    endVerse?: number; //calculated
    unversionedRenderingUrl?: string | null;
  };
  relationships?: {
    section: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
    sharedResource: RecordRelationship;
    passagetype: RecordRelationship;
  };
}

export type PassageD = Loaded<Passage>;

export default Passage;
