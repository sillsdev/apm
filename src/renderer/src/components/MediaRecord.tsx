import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
} from 'react';
import { useGlobal } from '../context/useGlobal';
import { IPassageRecordStrings, ISharedStrings } from '../model';
import { Stack, Paper, Typography } from '@mui/material';
import WSAudioPlayer, { WSAudioPlayerControls } from './WSAudioPlayer';
import {
  infoMsg,
  loadBlobAsync,
  logError,
  Severity,
  useMobile,
  waitForIt,
} from '../utils';
import {
  IMediaState,
  MediaSt,
  useFetchMediaUrl,
  useMediaUpload,
  convertToFormat,
} from '../crud';
import { useSnackBar } from '../hoc/SnackBar';
import { UnsavedContext } from '../context/UnsavedContext';
import { typeLimit } from '../utils/typeLimit';
import { isAudioLoadAbort } from '../utils/isAudioLoadAbort';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { useStepTool } from '../crud/useStepTool';
import { parseRecordCaptureAudioProcessing } from '../crud/useWavRecorder';
import { JSONParse } from '../utils';
import { UploadType } from './UploadType';
import { shallowEqual, useSelector } from 'react-redux';
import { passageRecordSelector, sharedSelector } from '../selector';

interface IProps {
  toolId: string;
  artifactId: string | null;
  passageId: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  topic?: string | undefined;
  languagebcp47?: string | undefined;
  keepItSmall?: boolean | undefined;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  /**
   * Domain restore metadata for pending-upload Retry (TT-7363).
   */
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  /**
   * Commit deferred metadata before the recorded upload is staged so
   * `pendingRestore` can include newly created category ids.
   */
  beforeUpload?: () => Promise<void>;
  onReady?: (() => void) | undefined;
  onSaving?: (() => void) | undefined;
  onRecording?: ((r: boolean) => void) | undefined;
  onPlayStatus?: ((p: boolean) => void) | undefined;
  mediaId?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  defaultFilename: string;
  allowDeltaVoice?: boolean | undefined;
  /** When false, hide the Download item in the recorder's more menu. Default true if omitted. */
  allowDownload?: boolean;
  setCanSave: (canSave: boolean) => void;
  /**
   * Called when a save attempt is rejected — the upload failed or finished
   * without a mediaId. May fire more than once for a single failed save, so
   * handlers must be idempotent. Parents that auto-save on the rising edge of
   * canSave use this to stop retrying the same doomed take (TT-7583); canSave
   * itself stays true so screens with a manual Save button keep their retry
   * path.
   */
  onSaveRejected?: (() => void) | undefined;
  setCanCancel?: ((canCancel: boolean) => void) | undefined;
  setStatusText: (status: string) => void;
  cancelMethod?: (() => void) | undefined;
  allowRecord?: boolean | undefined;
  oneTryOnly?: boolean | undefined;
  allowWave?: boolean | undefined;
  height?: number;
  width: number;
  doReset?: boolean | undefined;
  setDoReset?: ((r: boolean) => void) | undefined;
  preload?: number | undefined;
  onLoaded?: (() => void) | undefined;
  autoStart?: boolean | undefined;
  trackState?: ((mediaState: IMediaState) => void) | undefined;
  noNewVoice?: boolean | undefined;
  allowNoNoise?: boolean;
  allowZoom?: boolean;
  /** When true, disable drag-to-create-region (the red loop region) on the waveform. */
  disableDragSelection?: boolean;
  controlsRef?: React.RefObject<WSAudioPlayerControls | null>;
  hideControls?: boolean;
  onProgress?: (progress: number) => void;
  onDuration?: (duration: number) => void;
  hideToolbar?: boolean;
  hasRecording?: boolean;
  isStopLogic?: boolean;
  showSize?: boolean;
  handleUpload?: () => void;
  isRecordingRights?: boolean;
  rightsLeftActions?: React.JSX.Element;
  /** Force mobile layout (used by rights UI to match mobile experience on desktop). */
  forceMobileView?: boolean;
  onVersions?: () => void;
  handleSave?: () => void;
  isSaveDisabled?: boolean;
  dockRecordButton?: boolean;
  onDockedRecordButton?: (node: React.ReactNode | null) => void;
  /** When true, show the docked record button even if allowRecord is false (button may be disabled). */
  showDockedRecordButton?: boolean;
  /** Disable the record button without releasing the microphone. */
  recordBlocked?: boolean;
  onRecordingCleared?: () => void;
  /** Gate starting a new recording; return false (or resolve false) to abort. */
  onBeforeStartRecord?: () => boolean | Promise<boolean>;
}
export const DEFAULT_COMPRESSED_MIME = 'audio/ogg;codecs=opus';

function MediaRecord(props: IProps) {
  const {
    toolId,
    onReady,
    onSaving,
    onRecording,
    onPlayStatus,
    mediaId,
    defaultFilename,
    allowDeltaVoice,
    allowDownload,
    artifactId,
    passageId,
    planId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    topic,
    languagebcp47,
    afterUploadCb,
    pendingRestore,
    beforeUpload,
    setCanSave,
    setCanCancel,
    setStatusText,
    allowRecord,
    oneTryOnly,
    allowWave,
    autoStart,
    doReset,
    setDoReset,
    height,
    metaData,
    preload,
    onLoaded,
    trackState,
    noNewVoice,
    allowNoNoise,
    allowZoom,
    disableDragSelection,
    controlsRef,
    hideControls,
    onProgress,
    onDuration,
    hideToolbar,
    width,
    keepItSmall,
    hasRecording,
    isStopLogic,
    showSize = true,
    handleUpload,
    isRecordingRights,
    rightsLeftActions,
    forceMobileView,
    handleSave,
    onVersions,
    isSaveDisabled,
    dockRecordButton,
    onDockedRecordButton,
    showDockedRecordButton,
    recordBlocked,
    onRecordingCleared,
    onSaveRejected,
    onBeforeStartRecord,
  } = props;
  const context = usePassageDetailContext();
  const simplified = Boolean(context?.isBoldWorkflow);
  // Respect an explicit oneTryOnly={false} (discussion comments). Only default
  // to BOLD one-shot when the caller omits the prop (e.g. PassageDetailRecord).
  const effectiveOneTryOnly = oneTryOnly ?? simplified;
  const effectiveIsStopLogic = isStopLogic || simplified;
  const { settings: toolSettings } = useStepTool(context?.currentstep || '');
  const captureAudioProcessing = useMemo(
    () => parseRecordCaptureAudioProcessing(toolSettings),
    [toolSettings]
  );
  const t: IPassageRecordStrings = useSelector(passageRecordSelector);
  const WARNINGLIMIT = 1;
  /** Recorded WAV bytes/sec: mono 16-bit @ 48kHz (WavRecorder's preferred rate). */
  const RECORD_WAV_BYTES_PER_SECOND = 96000;
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const mediaStateRef = useRef(mediaState);
  const mediaStateFetchedTimeRef = useRef<number>(0);
  // TT-7609: the mediaId a load has been started for, and the one currently
  // wanted. A load or save in flight when mediaId changes used to swallow the
  // change for good — the take of the segment navigated to never appeared until
  // the recorder was remounted. These let the load be deferred instead of
  // dropped, and let an in-flight load notice it is now stale.
  const loadRequestedIdRef = useRef<string | undefined>(undefined);
  const mediaIdRef = useRef<string | undefined>(mediaId);
  mediaIdRef.current = mediaId;
  const [filetype, setFiletype] = useState('');
  const [originalBlob, setOriginalBlob] = useState<Blob>();
  const [audioBlob, setAudioBlob] = useState<Blob>();
  const [loading, setLoading] = useState(false);
  /**
   * True only while handleLoadAudio is fetching a take. Deliberately not a
   * mirror of `loading`, which the save path sets too: gating the abandon paths
   * on that would let a doReset arriving mid-save clear the flag and the status
   * text, re-enabling Record and dropping "Saving..." while the save ran. Set
   * synchronously so the [mediaId] and [doReset] effects see it immediately.
   */
  const loadInFlightRef = useRef(false);
  const [filechanged, setFilechangedx] = useState(false);
  const filechangedRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [blobReady, setBlobReady] = useState(true);
  // Determine MIME type from tool settings
  const getMimeTypeFromSettings = useCallback(() => {
    if (allowWave && toolSettings) {
      try {
        const settings = JSONParse(toolSettings) as { saveAsWav?: boolean };
        if (settings.saveAsWav) {
          return 'audio/wav';
        }
      } catch {
        // If parsing fails, use default
      }
    }
    return DEFAULT_COMPRESSED_MIME;
  }, [toolSettings, allowWave]);

  const initialMimeType = getMimeTypeFromSettings();
  const [mimeType, setMimeType] = useState(initialMimeType);
  const [compression, setCompression] = useState(
    initialMimeType === 'audio/wav' ? 1 : 20
  );
  const [warning, setWarning] = useState('');
  const [waveformDuration, setWaveformDuration] = useState(0);
  /** Sticky flag: once edits exist, keep Save visible through transient duration/filechanged blips. */
  const [pendingSave, setPendingSavex] = useState(false);
  const pendingSaveRef = useRef(false);
  const [processingRecording, setProcessingRecordingx] = useState(false);
  const processingRecordingRef = useRef(false);
  const [tooBig, setTooBig] = useState(false);
  const { showMessage } = useSnackBar();
  const [converting, setConverting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const {
    toolsChanged,
    saveRequested,
    saveCompleted,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const saveRef = useRef(false);
  const mediaSaveInProgress = saveRequested(toolId) || uploading || converting;
  const extensions = useMemo(
    () => ['mp3', 'mp3', 'webm', 'mka', 'm4a', 'wav', 'ogg'],
    []
  );
  const sizeLimit = typeLimit(UploadType.Media);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const mimes = useMemo(
    () => [
      'audio/mpeg',
      'audio/mp3',
      'audio/webm;codecs=opus',
      'audio/webm;codecs=pcm',
      'audio/x-m4a',
      'audio/wav',
      'audio/ogg;codecs=opus',
    ],
    []
  );
  const setFilechanged = (value: boolean) => {
    setFilechangedx(value);
    filechangedRef.current = value;
  };

  const setPendingSave = (value: boolean) => {
    if (value !== pendingSaveRef.current) {
      setPendingSavex(value);
      pendingSaveRef.current = value;
    }
  };

  const setProcessingRecording = (value: boolean) => {
    setProcessingRecordingx(value);
    processingRecordingRef.current = value;
  };

  const handleWaveformDuration = useCallback(
    (duration: number) => {
      setWaveformDuration((prev) => {
        // Only ignore a spurious zero while finalizing a recording stop (peaks race).
        if (duration <= 0 && processingRecordingRef.current) {
          return prev;
        }
        return duration;
      });
      if (duration > 0 || !processingRecordingRef.current) {
        onDuration?.(duration);
      }
    },
    [onDuration]
  );

  const getCompressedStatusMessage = useCallback(() => {
    if (allowWave) {
      return mimeType !== 'audio/wav' ? t.compressed : t.uncompressed;
    }
    return '';
  }, [allowWave, mimeType, t.compressed, t.uncompressed]);

  const myAfterUploadCb = async (mediaId: string) => {
    // Notify before any setState: canSave goes true again on the next commit,
    // and auto-save parents must already know this take was rejected or they
    // would retry it on that rising edge (TT-7583).
    if (!mediaId) onSaveRejected?.();
    // The take this id points at is already in the waveform, so the mediaId
    // change it triggers must not blank it and fetch it back (TT-7609).
    if (mediaId) loadRequestedIdRef.current = mediaId;
    setUploading(false);
    setPendingSave(false);
    if (filechangedRef.current && mediaId) setFilechanged(false);
    if (!mediaId) {
      showMessage(ts.NoSaveWoMedia);
      setStatusText(ts.NoSaveWoMedia);
      saveCompleted(toolId, ts.NoSaveWoMedia);
    } else {
      setStatusText(getCompressedStatusMessage());
      saveCompleted(toolId);
    }
    saveRef.current = false;
    await afterUploadCb(mediaId);
  };

  const uploadMedia = useMediaUpload({
    artifactId,
    passageId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    planId,
    topic,
    languagebcp47,
    afterUploadCb: myAfterUploadCb,
    pendingRestore,
    beforeUpload,
  });

  useEffect(() => {
    setConverting(false);
    setUploading(false);
    saveRef.current = false;
    setAudioBlob(undefined);
  }, []);

  useEffect(() => {
    if (mediaId !== mediaState.id) fetchMediaUrl({ id: mediaId ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  useEffect(() => {
    mediaStateRef.current = mediaState;
    // Track when mediaState is fetched
    if (mediaState.status === MediaSt.FETCHED) {
      mediaStateFetchedTimeRef.current = Date.now();
    }
    trackState && trackState(mediaState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState]);

  // Update MIME type when tool settings change
  useEffect(() => {
    const newMimeType = getMimeTypeFromSettings();
    setMimeType(newMimeType);
    setCompression(newMimeType === 'audio/wav' ? 1 : 20);
    // Show status message if allowWave is true but using compressed format
    // Only update if not currently showing a temporary status (saving, compressing, etc.)
    if (!uploading && !converting && !saveRef.current) {
      setStatusText(getCompressedStatusMessage());
    }
  }, [
    getMimeTypeFromSettings,
    setStatusText,
    uploading,
    converting,
    getCompressedStatusMessage,
  ]);

  useEffect(() => {
    setExtension(mimeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mimeType, extensions, mimes]);

  useEffect(() => {
    if (!recording && filechanged) {
      setPendingSave(true);
    }
  }, [recording, filechanged]);

  const wantsSaveVisible = useMemo(
    () =>
      waveformDuration > 0 &&
      !converting &&
      !uploading &&
      !recording &&
      (pendingSave || filechanged),
    [
      filechanged,
      waveformDuration,
      converting,
      uploading,
      recording,
      pendingSave,
    ]
  );

  const showProcessingRecordingMessage = useMemo(
    () =>
      !recording &&
      !converting &&
      !uploading &&
      (processingRecording ||
        (wantsSaveVisible && !blobReady && waveformDuration > 0)),
    [
      recording,
      converting,
      uploading,
      processingRecording,
      wantsSaveVisible,
      blobReady,
      waveformDuration,
    ]
  );

  useEffect(() => {
    const wantsSave = wantsSaveVisible && !saveRef.current;
    const needsSave = wantsSave && blobReady && waveformDuration > 0 && !tooBig;
    setCanSave(needsSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wantsSaveVisible,
    blobReady,
    processingRecording,
    tooBig,
    converting,
    uploading,
    recording,
    toolsChanged,
    waveformDuration,
  ]);

  useEffect(() => {
    if (setCanCancel) setCanCancel(!converting && !uploading);
  }, [converting, uploading, setCanCancel]);

  // While recording, audioBlob is the previous take (it only refreshes after
  // stop via onBlobReady). Estimate the eventual WAV size from the live
  // duration instead so the size warning shows before a long take is wasted;
  // the exact blob size takes over once recording stops.
  const effectiveAudioBytes = useMemo(
    () =>
      recording
        ? Math.round(waveformDuration * RECORD_WAV_BYTES_PER_SECOND)
        : (audioBlob?.size ?? 0),
    [recording, waveformDuration, audioBlob, RECORD_WAV_BYTES_PER_SECOND]
  );

  const { isMobile: isMobileView } = useMobile();
  const effectiveMobileView = Boolean(forceMobileView) || isMobileView;

  const doUpload = useCallback(
    async (blob: Blob, mimeType: string, filetype: string) => {
      setUploading(true);
      setStatusText(t.saving);
      const files = [
        new File([blob], defaultFilename + '.' + filetype, {
          type: mimeType,
        }),
      ];
      await uploadMedia(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultFilename, uploadMedia]
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
    [toolId, saveCompleted, onReady, onSaveRejected]
  );
  useEffect(() => {
    const limit = sizeLimit * compression;
    const big = effectiveAudioBytes > limit * 1000000;
    setTooBig(big);
    if (effectiveAudioBytes > (limit - WARNINGLIMIT) * 1000000)
      setWarning(
        (big ? t.toobig : t.toobigwarn).replace('{1}', limit.toString())
      );
    else setWarning('');

    if (saveRequested(toolId)) {
      if (!saveRef.current) {
        if (audioBlob && waveformDuration > 0) {
          onSaving && onSaving();
          saveRef.current = true;
          setLoading(true);
          if (mimeType !== 'audio/wav') {
            // Convert to target format
            setStatusText(t.compressing);
            setConverting(true);
            convertToFormat(audioBlob, mimeType)
              .then((convert_blob) =>
                doUpload(convert_blob, mimeType, filetype)
                  .then(() => {
                    convertComplete();
                  })
                  .catch(handleSaveFailed)
              )
              .catch((error) => {
                // If conversion fails, show error and save as WAV instead
                const errorMessage =
                  t.compressError +
                  (error instanceof Error ? '    ' + error.message : '');
                showMessage(errorMessage);
                setConverting(false);
                doUpload(audioBlob, 'audio/wav', 'wav')
                  .then(() => {
                    setLoading(false);
                    onReady?.();
                  })
                  .catch(handleSaveFailed);
              });
          } else {
            doUpload(audioBlob, mimeType, filetype)
              .then(() => {
                setLoading(false);
                onReady?.();
              })
              .catch(handleSaveFailed);
          }
          return;
        } else {
          // Save was requested with nothing to upload — a rejection like any
          // other, so auto-save parents must hear about it or they would keep
          // re-requesting on the next rising edge (TT-7583).
          onSaveRejected?.();
          showMessage(ts.NoSaveWoMedia);
          setStatusText(ts.NoSaveWoMedia);
          saveCompleted(toolId, ts.NoSaveWoMedia);
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
  }, [audioBlob, effectiveAudioBytes, toolsChanged, mimeType, toolId]);

  const setExtension = (mimeType: string) => {
    if (mimeType) {
      const i = mimes.findIndex((m) => m === mimeType);
      if (i >= 0) setFiletype(extensions[i] ?? '');
    }
  };

  function onBlobReady(blob: Blob | undefined) {
    setAudioBlob(blob);
  }
  function myOnRecording(r: boolean) {
    setRecording(r);
    if (onRecording) onRecording(r);
  }
  useEffect(() => {
    if (doReset) {
      abandonLoadInFlight();
      reset();
      setDoReset && setDoReset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doReset]);

  const reset = () => {
    setFilechanged(false);
    setPendingSave(false);
    setWaveformDuration(0);
    setProcessingRecording(false);
    setOriginalBlob(undefined);
    setAudioBlob(undefined);
    clearCompleted(toolId);
  };

  const handleRecordingCleared = useCallback(() => {
    setPendingSave(false);
    setBlobReady(true);
    setProcessingRecording(false);
    onRecordingCleared?.();
  }, [onRecordingCleared]);

  const gotTheBlob = (b: Blob) => {
    setOriginalBlob(b);
    // Keep loading true until wavesurfer reports ready (setBlobReady(true)).
    // Clearing here left Record looking idle while the waveform decoded.
    setBlobReady(false);
    onLoaded && onLoaded();
    setAudioBlob(b);
  };

  useEffect(() => {
    if (loading && blobReady && originalBlob && !saveRef.current) {
      loadInFlightRef.current = false;
      setLoading(false);
      setStatusText('');
    }
  }, [loading, blobReady, originalBlob, setStatusText]);
  /**
   * A load in flight is being abandoned - the segment was navigated away from,
   * or the recorder was reset. Without this, `loading` never clears again: the
   * effect that clears it needs originalBlob, and reset() has just dropped it.
   * The record button is disabled by Boolean(loading), so the recorder stayed
   * dead on this segment and every later one until the step was remounted
   * (TT-7621).
   */
  const abandonLoadInFlight = () => {
    if (!loadInFlightRef.current) return;
    loadInFlightRef.current = false;
    loadRequestedIdRef.current = undefined;
    setLoading(false);
    setStatusText('');
  };
  const stopLoading = () => {
    loadInFlightRef.current = false;
    setLoading(false);
    setStatusText('');
    onLoaded && onLoaded();
  };
  const blobError = (urlorError: string) => {
    showMessage(urlorError);
    stopLoading();
  };
  const handleWaveformLoadError = useCallback(
    (error?: unknown) => {
      if (isAudioLoadAbort(error)) {
        stopLoading();
        return;
      }
      blobError(ts.mediaError);
      setOriginalBlob(undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ts.mediaError, showMessage, onLoaded]
  );
  const getGoodUrl = async () => {
    const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutes in milliseconds
    const lastFetchedAt = mediaStateFetchedTimeRef.current;
    const timeSinceFetched = lastFetchedAt > 0 ? Date.now() - lastFetchedAt : 0;
    // If it's ready, force a new one if older than 20 minutes.
    const forceNewUrl =
      mediaStateRef.current.id === mediaId &&
      mediaStateRef.current.status === MediaSt.FETCHED &&
      mediaStateRef.current.url?.startsWith('http') &&
      timeSinceFetched > TWENTY_MINUTES;
    // Force it to go get another (unexpired) S3 URL
    if (forceNewUrl) {
      // Force requery for new media URL.
      fetchMediaUrl({ id: '' });
      await waitForIt(
        'requery url',
        () => mediaStateRef.current.id === '',
        () => false,
        500
      );
    }

    // If mediaState.id doesn't match mediaId, fetch the URL
    if (mediaStateRef.current.id !== mediaId) {
      fetchMediaUrl({ id: mediaId ?? '' });
    }
    // Wait for mediaState to be fetched before continuing
    await waitForIt(
      'fetch media url',
      () =>
        mediaStateRef.current.status === MediaSt.FETCHED &&
        mediaStateRef.current.id === mediaId,
      () => mediaStateRef.current.status === MediaSt.ERROR,
      500
    );
    if (
      mediaStateRef.current.status === MediaSt.FETCHED &&
      mediaStateRef.current.url
    )
      return mediaStateRef.current.url;
    return '';
  };
  const handleLoadAudio = async () => {
    if (loading || !mediaId) return;
    const requestedId = mediaId;
    loadRequestedIdRef.current = requestedId;
    loadInFlightRef.current = true;
    setLoading(true);
    // No status text here: setLoading(true) already puts the "Loading..."
    // overlay on the waveform below (TT-7570).
    setStatusText('');
    reset();

    try {
      const url = await getGoodUrl();
      // Navigated to another segment mid-fetch: this audio belongs to the one
      // we left, and handing it over would show the wrong take (TT-7609).
      if (mediaIdRef.current !== requestedId) {
        stopLoading();
        return;
      }
      if (!url) {
        blobError(mediaStateRef.current.error || ts.mediaError);
        return;
      }
      const blob = await loadBlobAsync(url);
      if (mediaIdRef.current !== requestedId) {
        stopLoading();
        return;
      }
      if (blob) gotTheBlob(blob);
      else blobError(ts.mediaError);
    } catch (error) {
      logError(
        Severity.error,
        reporter,
        infoMsg(error as Error, 'media load failed')
      );
      blobError(ts.mediaError);
    }
  };

  useEffect(() => {
    if ((preload ?? 0) > 0 && !loading) {
      handleLoadAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  useEffect(() => {
    if (!mediaId) {
      loadRequestedIdRef.current = undefined;
      abandonLoadInFlight();
      reset();
      return;
    }
    // Skip while saving — mediaId may update when the new mediafile syncs in.
    if (!loading) {
      handleLoadAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  // TT-7609: a save or an earlier segment's load in flight when mediaId changed
  // made the effect above skip that load, and nothing ever retried it — the take
  // of the segment navigated to stayed invisible until the step was remounted.
  // Run the skipped load as soon as the recorder goes idle. Loads only; the
  // reset above must stay tied to a real mediaId change so a take whose upload
  // failed is not wiped out from under the retry (TT-7583).
  useEffect(() => {
    if (loading || !mediaId) return;
    if (loadRequestedIdRef.current === mediaId) return;
    handleLoadAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mediaId]);

  const segments = '{}';

  const content = (
    <>
      <WSAudioPlayer
        allowRecord={allowRecord !== false}
        loading={loading}
        allowZoom={allowZoom}
        disableDragSelection={disableDragSelection}
        allowDeltaVoice={allowDeltaVoice}
        allowDownload={allowDownload}
        oneTryOnly={effectiveOneTryOnly}
        height={height || 300}
        mediaId={mediaId}
        planId={planId}
        blob={originalBlob}
        onBlobReady={onBlobReady}
        onLoadError={handleWaveformLoadError}
        setChanged={setFilechanged}
        onProcessingRecordingChange={setProcessingRecording}
        setBlobReady={setBlobReady}
        onRecording={myOnRecording}
        onPlayStatus={onPlayStatus}
        doReset={doReset}
        autoStart={autoStart}
        onProgress={onProgress}
        onDuration={handleWaveformDuration}
        controlsRef={controlsRef}
        hideToolbar={hideToolbar}
        hideControls={hideControls}
        segments={segments}
        reload={gotTheBlob}
        noNewVoice={noNewVoice}
        allowNoNoise={allowNoNoise}
        captureEchoCancellation={captureAudioProcessing.echoCancellation}
        captureNoiseSuppression={captureAudioProcessing.noiseSuppression}
        keepItSmall={keepItSmall}
        hasRecording={hasRecording ?? false}
        isStopLogic={effectiveIsStopLogic}
        hideWaveformEditTools={simplified}
        isRecordingRights={isRecordingRights}
        handleUpload={handleUpload}
        rightsLeftActions={rightsLeftActions}
        forceMobileView={forceMobileView}
        handleSave={handleSave}
        onVersions={onVersions}
        isSaveDisabled={
          Boolean(isSaveDisabled) ||
          waveformDuration <= 0 ||
          processingRecording ||
          tooBig ||
          (wantsSaveVisible && !blobReady)
        }
        mediaSaveInProgress={mediaSaveInProgress}
        showWaveformSave={wantsSaveVisible}
        dockRecordButton={dockRecordButton}
        onDockedRecordButton={onDockedRecordButton}
        showDockedRecordButton={showDockedRecordButton}
        recordBlocked={recordBlocked}
        onRecordingCleared={handleRecordingCleared}
        onBeforeStartRecord={onBeforeStartRecord}
      />
      {showProcessingRecordingMessage ? (
        <Typography sx={{ m: 2, color: 'text.secondary' }} id="warning">
          {t.processing}
        </Typography>
      ) : (
        warning && (
          <Typography sx={{ m: 2, color: 'warning.dark' }} id="warning">
            {warning}
          </Typography>
        )
      )}
      {(showSize || metaData) && !effectiveMobileView && (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
        >
          {showSize && (
            <Typography sx={{ mr: 3 }} id="size">
              {`${(effectiveAudioBytes / 1000000 / compression).toFixed(2)}MB`}
            </Typography>
          )}
          {metaData}
        </Stack>
      )}
    </>
  );

  if (!showSize && !metaData) {
    return content;
  }

  return effectiveMobileView ? (
    content
  ) : (
    <Paper
      id="mediaRecord"
      sx={{
        width: width, // isMobileView is false here
        maxWidth: width,
        minWidth: 0,
      }}
    >
      {content}
    </Paper>
  );
}
export default MediaRecord;
