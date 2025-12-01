import React from 'react';
import PlayCell from './PlayCell';
import { PassageTypeEnum } from '../../model/passageType';

export interface IRow {
  index: number;
  planid: string;
  passId: string;
  id: string;
  planName: string;
  playIcon: string;
  fileName: string;
  sectionId: string;
  sectionDesc: string;
  reference: React.ReactNode;
  referenceString: string; // String version of reference for sorting
  duration: string;
  size: number;
  version: string;
  date: string;
  readyToShare: boolean;
  publishTo: string;
  passageType: PassageTypeEnum;
  user: string;
  actions: typeof PlayCell;
}
