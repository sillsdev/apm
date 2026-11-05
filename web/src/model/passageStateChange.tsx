import { RecordRelationship } from '@orbit/records';
import { ActivityStates } from '.';
import { BaseModel, Loaded } from './baseModel';

export interface PassageStateChange extends BaseModel {
  attributes: {
    state: ActivityStates;
    comments: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
    offlineId: string;
  };
  relationships?: {
    passage: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type PassageStateChangeD = Loaded<PassageStateChange>;

export default PassageStateChange;
