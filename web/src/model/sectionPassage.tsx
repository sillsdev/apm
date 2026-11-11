import { Loaded } from './baseModel';
import { UninitializedRecord } from '@orbit/records';

export interface SectionPassage extends UninitializedRecord {
  attributes: {
    data: string;
    planId: number;
    uuid: string;
    complete: boolean;
  };
}

export type SectionPassageD = Loaded<SectionPassage>;

export default SectionPassage;
