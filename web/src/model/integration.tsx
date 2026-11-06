import { Loaded } from './baseModel';
import { RecordRelationship, UninitializedRecord } from '@orbit/records';

export interface Integration extends UninitializedRecord {
  attributes: {
    name: string;
    url: string;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export type IntegrationD = Loaded<Integration>;

export default Integration;
