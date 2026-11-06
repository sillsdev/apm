import { BaseModel, Loaded } from './baseModel';
import { RecordRelationship } from '@orbit/records';

export interface PassageType extends BaseModel {
  attributes: {
    usfm: string;
    title: string;
    abbrev: string;
    defaultOrder: number;
    lastModifiedBy: number;
    dateCreated: string;
    dateUpdated: string;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

export { PassageTypeEnum } from './passageTypeEnum';

export type PassageTypeD = Loaded<PassageType>;

export default PassageType;
