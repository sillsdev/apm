import { useCallback, useEffect } from 'react';
import { convertToFormat } from '../crud';
import { AlertSeverity } from '../hoc/SnackBar';
import { infoMsg, logError, Severity } from '../utils';
import { toError } from '../utils/toError';
import { SizeRejection, SizeStatus } from './useRecordSizeLimit';

type RefValue<T> = { current: T };

export type RecordSaveInput = {
  toolId: string;
  audioBlob: Blob | undefined;
  audioBlobRef: RefValue<Blob | undefined>;
  saveRef: RefValue<boolean>;
  submittedBlobRef: RefValue<Blob | undefined>;
  waveformDuration: number;
  mimeType: string;
  filetype: string;
  sizeStatus: SizeStatus;
  estimatedBytes: number;
  limitBytes: number;
  rejectionMessage: string | undefined;
  toolsChanged: unknown;
  defaultFilename: string;
  mediaError: string;
  noSaveWoMedia: string;
  compressing: string;
  compressError: string;
  tooBig: string;
  saving: string;
  reporter: Parameters<typeof logError>[1];
  onSaving?: () => void;
  onReady?: () => void;
  onSaveRejected?: () => void;
  onStageFile?: ((files: File[]) => void | Promise<void>) | undefined;
  uploadMedia: (files: File[]) => Promise<boolean>;
  saveRequested: (toolId: string) => boolean;
  saveCompleted: (toolId: string, saveErr?: string) => void;
  clearRequested: (toolId: string) => boolean;
  setLoading: (value: boolean) => void;
  setConverting: (value: boolean) => void;
  setUploading: (value: boolean) => void;
  setStatusText: (status: string) => void;
  setDoReset?: (value: boolean) => void;
  showMessage: (msg: string, alert?: AlertSeverity) => void;
  formatSize: (template: string, bytes: number) => string;
  rejectTake: (blob: Blob, rejection: SizeRejection) => string;
  reset: () => void;
};

/** Starts a requested save, and abandons it when the take changes first. */
export function useRecordSave(input: RecordSaveInput) {
  const {
    toolId,
    audioBlob,
    audioBlobRef,
    saveRef,
    submittedBlobRef,
    waveformDuration,
    mimeType,
    filetype,
    sizeStatus,
    estimatedBytes,
    limitBytes,
    rejectionMessage,
    toolsChanged,
    defaultFilename,
    mediaError,
    noSaveWoMedia,
    compressing,
    compressError,
    tooBig,
    saving,
    reporter,
    onSaving,
    onReady,
    onSaveRejected,
    onStageFile,
    uploadMedia,
    saveRequested,
    saveCompleted,
    clearRequested,
    setLoading,
    setConverting,
    setUploading,
    setStatusText,
    setDoReset,
    showMessage,
    formatSize,
    rejectTake,
    reset,
  } = input;

  const doUpload = useCallback(
    async (blob: Blob, type: string, ext: string) => {
      const files = [new File([blob], defaultFilename + '.' + ext, { type })];
      if (onStageFile) {
        // General-resource flow: hand the finished take up to be uploaded
        // later, after the user picks passages. Await it so a failure rejects
        // into the caller's catch instead of being swallowed while the save
        // is reported complete. The caller still finishes the recorder.
        await onStageFile(files);
        saveRef.current = false;
        saveCompleted(toolId);
        setStatusText('');
        return;
      }
      setUploading(true);
      setStatusText(saving);
      await uploadMedia(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultFilename, uploadMedia, onStageFile, toolId]
  );

  const convertComplete = () => {
    setConverting(false);
    setLoading(false);
    onReady?.();
  };

  const handleSaveFailed = useCallback(
    (error: unknown) => {
      saveRef.current = false;
      // Before the setState calls below, for the reason in myAfterUploadCb.
      onSaveRejected?.();
      setUploading(false);
      setConverting(false);
      setLoading(false);
      const message =
        error instanceof Error ? error.message : String(error ?? 'Save failed');
      saveCompleted(toolId, message);
      onReady?.();
    },
    [
      toolId,
      saveCompleted,
      onReady,
      onSaveRejected,
      saveRef,
      setUploading,
      setConverting,
      setLoading,
    ]
  );

  useEffect(() => {
    if (sizeStatus === 'pending') return;

    if (saveRequested(toolId)) {
      if (!saveRef.current) {
        if (audioBlob && waveformDuration > 0 && sizeStatus !== 'rejected') {
          onSaving && onSaving();
          saveRef.current = true;
          submittedBlobRef.current = audioBlob;
          setLoading(true);
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
            const ready = () => {
              setLoading(false);
              onReady?.();
            };
            if (mimeType !== 'audio/wav') {
              setStatusText(compressing);
              setConverting(true);
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
                setConverting(false);
                await uploadThen(take, 'audio/wav', 'wav', ready);
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
              await uploadThen(converted, mimeType, filetype, convertComplete);
              return;
            }
            await uploadThen(take, mimeType, filetype, ready);
          };
          void saveTake().catch((error: unknown) => {
            if (!dropped()) handleSaveFailed(error);
          });
          return;
        } else if (sizeStatus === 'rejected') {
          // Already rejected. Skipping both the upload and the empty-take
          // branch left page-level Save and auto-save stuck on "saving"
          // (TT-7583). Report the same rejection again.
          const message =
            rejectionMessage ||
            formatSize(tooBig, audioBlob?.size ?? estimatedBytes);
          showMessage(message, AlertSeverity.Error);
          handleSaveFailed(new Error(message));
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
      saveRef.current = false;
      if (clearRequested(toolId)) {
        reset();
        setDoReset && setDoReset(true);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, estimatedBytes, sizeStatus, toolsChanged, mimeType, toolId]);
}
