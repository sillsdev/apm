import { OfflineProject } from '../model';
import Memory from '@orbit/memory';
import { RecordOperation, RecordTransformBuilder } from '@orbit/records';
import { related } from '.';
import { currentDateTime } from '../utils';
import { findRecords } from './tryFindRecord';

export const offlineProjectFromProject = (
  memory: Memory,
  projectid: string
) => {
  const orec = findRecords(memory, 'offlineproject');
  const oprecs = orec.filter((r) => related(r, 'project') === projectid);
  if (oprecs.length > 0) {
    return oprecs[0];
  }
  return undefined;
};
export const offlineProjectUpdateSnapshot = (
  projectid: string,
  ops: RecordOperation[],
  memory: Memory,
  newDate: string,
  startNext: number,
  filesToo: boolean
) => {
  const tb = new RecordTransformBuilder();
  const oprec = offlineProjectFromProject(memory, projectid);
  if (oprec) {
    const proj = {
      ...oprec,
      attributes: {
        dateUpdated: newDate,
        startNext: startNext,
      },
    } as OfflineProject;
    if (startNext === 0) proj.attributes.snapshotDate = newDate;

    if (filesToo) {
      proj.attributes.offlineAvailable = true;
      proj.attributes.fileDownloadDate = newDate;
    }
    ops.push(tb.updateRecord(proj).toOperation());
    return true;
  } else return false;
};

export const offlineProjectUpdateFilesDownloaded = (
  projectid: string,
  ops: RecordOperation[],
  memory: Memory,
  newDate: string
) => {
  const tb = new RecordTransformBuilder();
  const oprec = offlineProjectFromProject(memory, projectid);
  if (oprec) {
    const proj = {
      ...oprec,
      attributes: {
        fileDownloadDate: newDate,
        dateUpdated: currentDateTime(),
      },
    } as OfflineProject;
    ops.push(tb.updateRecord(proj).toOperation());
    return true;
  } else return false;
};
