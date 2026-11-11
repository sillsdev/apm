import { RecordRelationship } from '@orbit/records';
import { BaseModel, Loaded } from './baseModel';

export interface Project extends BaseModel {
  attributes: {
    name: string;
    slug: string;
    description: string | null;
    uilanguagebcp47: string | null;
    language: string;
    languageName: string | null;
    defaultFont: string | null;
    defaultFontSize: string | null;
    rtl: boolean;
    spellCheck: boolean;
    allowClaim: boolean;
    isPublic: boolean;
    dateCreated: string;
    dateUpdated: string;
    dateArchived: string;
    lastModifiedBy: number;
    defaultParams: string;
  };
  relationships?: {
    projecttype: RecordRelationship;
    owner: RecordRelationship;
    organization: RecordRelationship;
    group: RecordRelationship;
    plans: RecordRelationship;
    lastModifiedByUser: RecordRelationship;
    editsheetuser: RecordRelationship;
    editsheetgroup: RecordRelationship;
    publishuser: RecordRelationship;
    publishgroup: RecordRelationship;
  };
}

export type ProjectD = Loaded<Project>;

export default Project;
