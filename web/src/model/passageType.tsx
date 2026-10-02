import { InitializedRecord, UninitializedRecord } from '@orbit/records';

export interface PassageType extends UninitializedRecord {
  attributes: {
    usfm: string;
    title: string;
    abbrev: string;
    defaultOrder: number;
  };
}

export { PassageTypeEnum } from './passageTypeEnum';

export type PassageTypeD = PassageType & InitializedRecord;

export default PassageType;
