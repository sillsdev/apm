import { RecordIdentity } from '@orbit/records';
import { PassageTypeEnum } from './passageType';
import { PassageD, SharedResourceD } from '.';
import { PublishDestinationEnum } from '../crud/usePublishDestination';

export enum IwsKind {
  Section,
  Passage,
  SectionPassage,
  Task,
  SubTask,
}
export enum IMediaShare {
  Latest,
  OldVersionOnly,
  None,
  NotPublic,
}
export enum SheetLevel {
  Book = 1,
  Movement,
  Section,
  SubSection,
  Passage,
}
export interface ISheet {
  level: SheetLevel; //currently not used anywhere
  kind: IwsKind;
  sectionSeq: number;
  title?: string | undefined;
  scheme?: RecordIdentity | undefined;
  assign?: RecordIdentity | undefined;
  sectionId?: RecordIdentity | undefined;
  sectionUpdated?: string | undefined;
  passageSeq: number;
  book?: string | undefined;
  reference?: string | undefined;
  comment?: string | undefined;
  passage?: PassageD | undefined;
  sharedResource?: SharedResourceD | undefined;
  passageType: PassageTypeEnum;
  passageUpdated?: string | undefined;
  mediaId?: RecordIdentity | undefined;
  mediaShared?: IMediaShare | undefined;
  publishStatus?: string | undefined;
  step?: string | undefined;
  stepId?: string | undefined;
  deleted: boolean;
  filtered: boolean;
  discussionCount?: number | undefined;
  published: PublishDestinationEnum[];
  graphicUri?: string | undefined;
  graphicRights?: string | undefined;
  graphicFullSizeUrl?: string | undefined;
  color?: string | undefined;
  titleMediaId?: RecordIdentity | undefined;
  myWork?: boolean | undefined;
}

export const flatScrColNames = [
  'sectionSeq',
  'title',
  'book',
  'reference',
  'comment',
];
export const flatGenColNames = ['sectionSeq', 'title', 'reference', 'comment'];
export const levScrColNames = [
  'sectionSeq',
  'title',
  'passageSeq',
  'book',
  'reference',
  'comment',
];
export const levGenColNames = [
  'sectionSeq',
  'title',
  'passageSeq',
  'reference',
  'comment',
];
