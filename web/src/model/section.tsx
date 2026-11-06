import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export const BookSeq = -4;
export const AltBkSeq = -3;

export interface Section extends BaseModel {
  attributes: {
    sequencenum: number;
    name: string;
    graphics: string;
    published: boolean;
    publishTo: string;
    level: number;
    state: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    // project: RecordRelationship;
    plan: RecordRelationship;
    passages: RecordRelationship;
    transcriber: RecordRelationship;
    editor: RecordRelationship;
    group: RecordRelationship;
    titleMediafile: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
    organizationScheme: RecordRelationship;
  };
}

export type SectionD = Loaded<Section>;

export default Section;
