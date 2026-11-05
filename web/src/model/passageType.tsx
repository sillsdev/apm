import { Loaded } from './baseModel';
import { UninitializedRecord } from '@orbit/records';

export interface PassageType extends UninitializedRecord {
  attributes: {
    usfm: string;
    title: string;
    abbrev: string;
    defaultOrder: number;
  };
}

export { PassageTypeEnum } from './passageTypeEnum';

export type PassageTypeD = Loaded<PassageType>;

export default PassageType;
