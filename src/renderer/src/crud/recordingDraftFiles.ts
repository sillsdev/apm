import { MainAPI } from '@model/main-api';
import bugsnagClient from '../auth/bugsnagClient';
import { isElectron } from '../../api-variable';
import { dataPath, PathType } from '../utils/dataPath';
import { infoMsg } from '../utils/infoMsg';
import { logError, Severity } from '../utils/logErrorService';
import { getDraft, removeDraft } from './recordingDraftStore';

const getIpc = () => window?.api as MainAPI | undefined;

export async function resolveDraftAbsolutePath(
  relativeMediaPath: string
): Promise<string | undefined> {
  if (!relativeMediaPath || relativeMediaPath.startsWith('http')) {
    return undefined;
  }
  if (!isElectron || !getIpc()) return undefined;
  const local = { localname: '' };
  const absolutePath = await dataPath(
    relativeMediaPath,
    PathType.MEDIA,
    local
  );
  if (!absolutePath || absolutePath.startsWith('http')) {
    return undefined;
  }
  return absolutePath;
}

export async function deleteDraftFileIfPresent(
  relativeMediaPath: string,
  reporter?: typeof bugsnagClient
): Promise<void> {
  try {
    const absolutePath = await resolveDraftAbsolutePath(relativeMediaPath);
    if (!absolutePath) return;
    const ipc = getIpc();
    if (ipc && (await ipc.exists(absolutePath))) {
      await ipc.delete(absolutePath);
    }
  } catch (err: unknown) {
    if (reporter) {
      logError(
        Severity.error,
        reporter,
        infoMsg(err as Error, 'recording draft file delete failed')
      );
    }
  }
}

export async function purgeRecordingDraft(
  passageId: string,
  reporter?: typeof bugsnagClient
): Promise<void> {
  if (!passageId) return;
  const draft = getDraft(passageId);
  if (draft?.relativeMediaPath) {
    await deleteDraftFileIfPresent(draft.relativeMediaPath, reporter);
  }
  removeDraft(passageId);
}
