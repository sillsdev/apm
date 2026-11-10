import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface SharedResource extends BaseModel {
  attributes: {
    title: string;
    description: string;
    languagebcp47: string;
    termsOfUse: string;
    keywords: string;
    note: boolean;
    linkurl: string;
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships: {
    passage: RecordRelationship;
    cluster: RecordRelationship; //organization
    artifactCategory: RecordRelationship;
    titleMediafile: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
  };
}

export type SharedResourceD = Loaded<SharedResource>;

export default SharedResource;
