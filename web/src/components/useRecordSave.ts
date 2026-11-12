import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ICtxState } from '../context/UnsavedContext';
import { convertToFormat, useMediaUpload } from '../crud';
import { AlertSeverity, type useSnackBar } from '../hoc/useSnackBar';
import { infoMsg, logError, Severity } from '../utils';
import { toError } from '../utils/toError';
import type { IProps as MediaRecordProps } from './MediaRecord';
import type { SizeRejection, SizeStatus } from './useRecordSizeLimit';

export type RecordSaveInput = {
  toolId: string;
  audioBlob: Blob | undefined;
  audioBlobRef: RefObject<Blob | undefined>;
  waveformDuration: number;
  mimeType: string;
  filetype: string;
  sizeStatus: SizeStatus;
  limitBytes: number;
  rejectionMessage: string | undefined;
  toolsChanged: ICtxState['toolsChanged'];
  defaultFilename: string;
  mediaError: string;
  noSaveWoMedia: string;
  compressing: string;
  compressError: string;
  saving: string;
  reporter: Parameters<typeof logError>[1];
  onSaving?: () => void;
  onReady?: () => void;
  onSaveRejected?: () => void;
  onStageFile?: MediaRecordProps['onStageFile'];
  /** Page work after the file is accepted. Called with the take that was sent. */
  onUploaded: (mediaId: string, submitted: Blob | undefined) => Promise<void>;
  upload: Omit<Parameters<typeof useMediaUpload>[0], 'afterUploadCb'>;
  saveRequested: ICtxState['saveRequested'];
  saveCompleted: ICtxState['saveCompleted'];
  clearRequested: ICtxState['clearRequested'];
  setStatusText: (status: string) => void;
  setDoReset?: (value: boolean) => void;
  showMessage: ReturnType<typeof useSnackBar>['showMessage'];
  rejectTake: (blob: Blob, rejection: SizeRejection) => string;
  reset: () => void;
};

/** Starts a requested save, and abandons it when the take changes first. */
export function useRecordSave(input: RecordSaveInput) {
  const {
    toolId,
    audioBlob,
    audioBlobRef,
    waveformDuration,
    mimeType,
    filetype,
    sizeStatus,
    limitBytes,
    rejectionMessage,
    toolsChanged,
    defaultFilename,
    mediaError,
    noSaveWoMedia,
    compressing,
    compressError,
    saving,
    reporter,
    onSaving,
    onReady,
    onSaveRejected,
    onStageFile,
    onUploaded,
    upload,
    saveRequested,
    saveCompleted,
    clearRequested,
    setStatusText,
    setDoReset,
    showMessage,
    rejectTake,
    reset,
  } = input;

  const [inFlight, setInFlight] = useState(false);
  /** Blocks a second start. Cleared when the request drops, before the overlay does. */
  const savingRef = useRef(false);
  const submittedBlobRef = useRef<Blob | undefined>(undefined);

  const uploadMedia = useMediaUpload({
    ...upload,
    afterUploadCb: (mediaId) => onUploaded(mediaId, submittedBlobRef.current),
  });

  useEffect(() => {
    if (sizeStatus === 'pending') return;

    const handleSaveFailed = (error: unknown) => {
      savingRef.current = false;
      // Tell the page before the status update. canSave turns back on on the
      // next commit, and auto-save would retry this take on that rising edge
      // (TT-7583).
      onSaveRejected?.();
      setInFlight(false);
      const message = toError(error).message || 'Save failed';
      saveCompleted(toolId, message);
      onReady?.();
    };

    const doUpload = async (blob: Blob, type: string, ext: string) => {
      const files = [new File([blob], defaultFilename + '.' + ext, { type })];
      if (onStageFile) {
        // Hand the finished take up to be uploaded later, after passages are
        // chosen. Await it so a failure rejects into the caller instead of
        // being swallowed while the save is reported complete.
        await onStageFile(files);
        saveCompleted(toolId);
        setStatusText('');
        return;
      }
      setStatusText(saving);
      await uploadMedia(files);
    };

    if (saveRequested(toolId)) {
      if (!savingRef.current) {
        if (audioBlob && waveformDuration > 0 && sizeStatus !== 'rejected') {
          onSaving && onSaving();
          submittedBlobRef.current = audioBlob;
          savingRef.current = true;
          setInFlight(true);
          const take = audioBlob;
          const dropped = () => {
            if (audioBlobRef.current === take) return false;
            // The take changed. Finish the page-level save or it stays on "saving".
            handleSaveFailed(new Error(mediaError));
            return true;
          };
          const rejectOversized = (rejection: SizeRejection) => {
            if (dropped()) return;
            const message = rejectTake(take, rejection);
            showMessage(message, AlertSeverity.Error);
            handleSaveFailed(new Error(message));
          };
          // Handles its own failures. A later step must not share the
          // compression catch, or a size-check error would upload WAV.
          const saveTake = async () => {
            const uploadThen = async (
              blob: Blob,
              type: string,
              ext: string,
              done: () => void
            ) => {
              try {
                await doUpload(blob, type, ext);
              } catch (uploadError) {
                // The upload already settled. Report its own error.
                handleSaveFailed(uploadError);
                return;
              }
              done();
            };
            // Overlay stays up through the upload callback, then drops here.
            const finish = () => {
              savingRef.current = false;
              setInFlight(false);
              onReady?.();
            };
            if (mimeType !== 'audio/wav') {
              setStatusText(compressing);
              let converted: Blob;
              try {
                converted = await convertToFormat(take, mimeType);
              } catch (error: unknown) {
                if (dropped()) return;
                const err = toError(error);
                logError(
                  Severity.error,
                  reporter,
                  infoMsg(err, 'compression failed')
                );
                if (take.size > limitBytes) {
                  rejectOversized({
                    kind: 'compressFailed',
                    bytes: take.size,
                    detail: err.message,
                  });
                  return;
                }
                showMessage(`${compressError}  ${err.message}`);
                await uploadThen(take, 'audio/wav', 'wav', finish);
                return;
              }
              if (dropped()) return;
              if (converted.size > limitBytes) {
                rejectOversized({
                  kind: 'afterCompression',
                  bytes: converted.size,
                });
                return;
              }
              await uploadThen(converted, mimeType, filetype, finish);
              return;
            }
            await uploadThen(take, mimeType, filetype, finish);
          };
          void saveTake().catch((error: unknown) => {
            if (!dropped()) handleSaveFailed(error);
          });
          return;
        } else if (sizeStatus === 'rejected') {
          // Already rejected. Skipping both the upload and the empty-take
          // branch left page-level Save and auto-save stuck on "saving"
          // (TT-7583). Report the same rejection again.
          showMessage(rejectionMessage ?? '', AlertSeverity.Error);
          handleSaveFailed(new Error(rejectionMessage ?? ''));
        } else {
          // Save was requested with nothing to upload — a rejection like any
          // other, so auto-save parents must hear about it or they would keep
          // re-requesting on the next rising edge (TT-7583).
          onSaveRejected?.();
          showMessage(noSaveWoMedia);
          setStatusText(noSaveWoMedia);
          saveCompleted(toolId, noSaveWoMedia);
          onReady && onReady();
        }
      }
    } else {
      savingRef.current = false;
      if (clearRequested(toolId)) {
        reset();
        setDoReset && setDoReset(true);
      }
    }

    // Left out: callbacks (including onUploaded and onReady), message strings
    // (including saving), filetype, uploadMedia, limitBytes, rejectionMessage,
    // and reset. They change on parent renders and language switches, which is
    // not a new save. The run that starts a save closes over that render's
    // strings; the next save bumps toolsChanged, which is a dependency.
    // Re-running while a save is not yet latched would start a second one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, sizeStatus, toolsChanged, mimeType, toolId]);

  return { inFlight };
}
