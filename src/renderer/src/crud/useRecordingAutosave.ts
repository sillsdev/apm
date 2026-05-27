import { useCallback, useEffect, useMemo, useRef } from 'react';
import { debounce } from '@mui/material';
import { writeFileLocal } from '../store/upload/actions';
import { removeDraft, upsertDraft } from './recordingDraftStore';
import { useSnackBar } from '../hoc/SnackBar';
import { infoMsg } from '../utils/infoMsg';
import { logError, Severity } from '../utils/logErrorService';
import { useGlobal } from '../context/useGlobal';

export const RECORDING_AUTOSAVE_DEBOUNCE_MS = 1200;

interface IProps {
  passageId: string | undefined;
  mediaId: string | undefined;
  audioBlob: Blob | undefined;
  performedBy: string | undefined;
  mimeType: string;
  filetype: string;
  defaultFilename: string;
  blobReady: boolean;
  filechanged: boolean;
  recording: boolean;
  converting: boolean;
  uploading: boolean;
  tooBig: boolean;
  mediaSaveInProgress: boolean;
  setStatusText: (status: string) => void;
  autosavedLocallyText?: string;
  getCompressedStatusMessage?: () => string;
}

export const useRecordingAutosave = ({
  passageId,
  mediaId,
  audioBlob,
  performedBy,
  mimeType,
  filetype,
  defaultFilename,
  blobReady,
  filechanged,
  recording,
  converting,
  uploading,
  tooBig,
  mediaSaveInProgress,
  setStatusText,
  autosavedLocallyText,
  getCompressedStatusMessage,
}: IProps) => {
  const { showMessage } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');

  const saveDraft = useCallback(async () => {
    if (!passageId || !audioBlob || !filetype) return;
    try {
      const blobType = audioBlob.type || mimeType;
      const file = new File(
        [audioBlob],
        `${defaultFilename}.${filetype}`,
        { type: blobType }
      );
      const written = await writeFileLocal(file);
      upsertDraft({
        passageId,
        mediafileId: mediaId,
        relativeMediaPath: written.relativeMediaPath,
        performedBy,
        mimeType: blobType,
        filetype,
      });
      if (autosavedLocallyText) {
        setStatusText(autosavedLocallyText);
      }
    } catch (err: unknown) {
      logError(
        Severity.error,
        reporter,
        infoMsg(err as Error, 'recording draft autosave failed')
      );
      showMessage(
        err instanceof Error ? err.message : 'Recording autosave failed'
      );
    }
  }, [
    passageId,
    mediaId,
    audioBlob,
    performedBy,
    mimeType,
    filetype,
    defaultFilename,
    autosavedLocallyText,
    setStatusText,
    showMessage,
    reporter,
  ]);

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  const scheduleAutosave = useMemo(
    () =>
      debounce(() => {
        void saveDraftRef.current();
      }, RECORDING_AUTOSAVE_DEBOUNCE_MS),
    []
  );

  useEffect(
    () => () => {
      scheduleAutosave.clear();
    },
    [scheduleAutosave]
  );

  useEffect(() => {
    const shouldAutosave =
      Boolean(passageId) &&
      blobReady &&
      filechanged &&
      !recording &&
      !converting &&
      !uploading &&
      !tooBig &&
      !mediaSaveInProgress &&
      Boolean(audioBlob);
    if (!shouldAutosave) return;
    scheduleAutosave();
  }, [
    passageId,
    blobReady,
    filechanged,
    recording,
    converting,
    uploading,
    tooBig,
    mediaSaveInProgress,
    audioBlob,
    scheduleAutosave,
  ]);

  const clearDraft = useCallback(() => {
    if (passageId) removeDraft(passageId);
  }, [passageId]);

  const restoreStatusAfterAutosave = useCallback(() => {
    if (getCompressedStatusMessage) {
      setStatusText(getCompressedStatusMessage());
    }
  }, [getCompressedStatusMessage, setStatusText]);

  return { clearDraft, scheduleAutosave, restoreStatusAfterAutosave };
};
