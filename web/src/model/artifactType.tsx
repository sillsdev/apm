import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface ArtifactType extends BaseModel {
  attributes: {
    typename: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    organization: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type ArtifactTypeD = Loaded<ArtifactType>;

export default ArtifactType;
