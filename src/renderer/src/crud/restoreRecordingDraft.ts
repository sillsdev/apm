import MemorySource from '@orbit/memory';
import { MainAPI } from '@model/main-api';
import { MediaFileD } from '../model';
import { findRecord } from './tryFindRecord';
import { dataPath, PathType } from '../utils/dataPath';
import { loadBlobAsync } from '../utils/loadBlob';
import {
  getDraft,
  RecordingDraft,
  shouldRestoreDraft,
} from './recordingDraftStore';
import { isElectron } from '../../api-variable';

const ipc = window?.api as MainAPI;

const draftToFileUrl = async (relativeMediaPath: string): Promise<string> => {
  const local = { localname: '' };
  const absolutePath = await dataPath(
    relativeMediaPath,
    PathType.MEDIA,
    local
  );
  if (!absolutePath || absolutePath.startsWith('http')) {
    return absolutePath;
  }
  if (isElectron && ipc) {
    const start = (await ipc.isWindows()) ? 8 : 7;
    const url = new URL(`file://${absolutePath}`).toString().slice(start);
    return `file://${url}`;
  }
  return absolutePath;
};

export interface RestoredRecordingDraft {
  blob: Blob;
  draft: RecordingDraft;
}

export async function restoreRecordingDraft(
  passageId: string | undefined,
  mediaId: string | undefined,
  memory: MemorySource
): Promise<RestoredRecordingDraft | null> {
  if (!passageId) return null;
  const draft = getDraft(passageId);
  if (!draft) return null;

  let mediaDateUpdated: string | undefined;
  if (mediaId) {
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      | MediaFileD
      | undefined;
    mediaDateUpdated = mediaRec?.attributes?.dateUpdated;
  }

  if (!shouldRestoreDraft(draft, mediaDateUpdated)) return null;

  const url = await draftToFileUrl(draft.relativeMediaPath);
  if (!url) return null;

  const blob = await loadBlobAsync(url);
  if (!blob) return null;

  return { blob, draft };
}
