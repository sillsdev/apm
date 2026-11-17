import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
} from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { IPassageRecordStrings, ISharedStrings } from '../model';
import {
  infoMsg,
  loadBlobAsync,
  logError,
  Severity,
  waitForIt,
} from '../utils';
import { isElectron } from '../../api-variable';
import { MediaSt, useFetchMediaUrl } from '../crud';
import { useSnackBar } from '../hoc/SnackBar';
import { UnsavedContext } from '../context/UnsavedContext';
import { typeLimit } from '../utils/typeLimit';
import { isAudioLoadAbort } from '../utils/isAudioLoadAbort';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { useStepTool } from '../crud/useStepTool';
import { parseRecordCaptureAudioProcessing } from '../crud/useWavRecorder';
import { JSONParse } from '../utils';
import { UploadType } from './UploadType';
import { toError } from '../utils/toError';
import { useRecordSizeLimit } from './useRecordSizeLimit';
import { useRecordSave } from './useRecordSave';
import { shallowEqual, useSelector } from 'react-redux';
import { passageRecordSelector, sharedSelector } from '../selector';
import type { IProps } from './MediaRecord';

export const DEFAULT_COMPRESSED_MIME = 'audio/ogg;codecs=opus';

// The props that drive the recorder's state and save logic (as opposed to how
// it renders). A host that needs to read that state (e.g. canSave) during its
// own render calls useMediaRecord itself and renders MediaRecordView, instead
// of having MediaRecord copy values up through setCanSave.
export type MediaRecordStateKey =
  | 'toolId'
  | 'onReady'
  | 'onSaving'
  | 'onRecording'
  | 'mediaId'
  | 'defaultFilename'
  | 'artifactId'
  | 'passageId'
  | 'planId'
  | 'sourceMediaId'
  | 'sourceSegments'
  | 'performedBy'
  | 'topic'
  | 'languagebcp47'
  | 'afterUploadCb'
  | 'finish'
  | 'pendingRestore'
  | 'uploadType'
  | 'beforeUpload'
  | 'setStatusText'
  | 'oneTryOnly'
  | 'allowWave'
  | 'doReset'
  | 'setDoReset'
  | 'preload'
  | 'trackState'
  | 'isStopLogic'
  | 'onRecordingCleared'
  | 'onSaveRejected';

export type IMediaRecordStateProps = Pick<IProps, MediaRecordStateKey> & {
  setCanSave?: IProps['setCanSave'] | undefined;
};

/** The recorder's state and save logic; render it with MediaRecordView. */
export function useMediaRecord(props: IMediaRecordStateProps) {
  const {
    toolId,
    onReady,
    onSaving,
    onRecording,
    mediaId,
    defaultFilename,
    artifactId,
    passageId,
    planId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    topic,
    languagebcp47,
    afterUploadCb,
    finish,
    pendingRestore,
    uploadType = UploadType.Media,
    beforeUpload,
    setCanSave,
    setStatusText,
    oneTryOnly,
    allowWave,
    doReset,
    setDoReset,
    preload,
    trackState,
    isStopLogic,
    onRecordingCleared,
    onSaveRejected,
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
  const [audioBlob, setAudioBlobx] = useState<Blob>();
  const audioBlobRef = useRef(audioBlob);
  const setAudioBlob = (value: Blob | undefined) => {
    setAudioBlobx(value);
    audioBlobRef.current = value;
  };
  /**
   * TT-7365: the take a failed desktop save left in the Pending Media Uploads
   * queue. Saving it again unchanged would stage a second pending row for the
   * same recording, so Save stays off until the waveform holds a different take
   * (which uploads as a new version).
   */
  const [queuedTake, setQueuedTake] = useState<Blob | undefined>();
  const [loadBusy, setLoadBusy] = useState(false);
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
  const saveAsWav = mimeType === 'audio/wav';
  const [waveformDuration, setWaveformDuration] = useState(0);
  /** Sticky flag: once edits exist, keep Save visible through transient duration/filechanged blips. */
  const [pendingSave, setPendingSavex] = useState(false);
  const pendingSaveRef = useRef(false);
  const [processingRecording, setProcessingRecordingx] = useState(false);
  const processingRecordingRef = useRef(false);
  const { showMessage } = useSnackBar();
  const getGlobal = useGetGlobal();
  const {
    toolsChanged,
    saveRequested,
    saveCompleted,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const extensions = useMemo(
    () => ['mp3', 'mp3', 'webm', 'mka', 'm4a', 'wav', 'ogg'],
    []
  );
  const sizeLimit = typeLimit(uploadType);
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

  const handleWaveformDuration = useCallback((duration: number) => {
    setWaveformDuration((prev) => {
      // Only ignore a spurious zero while finalizing a recording stop (peaks race).
      if (duration <= 0 && processingRecordingRef.current) {
        return prev;
      }
      return duration;
    });
  }, []);

  const getCompressedStatusMessage = useCallback(() => {
    if (allowWave) {
      return mimeType !== 'audio/wav' ? t.compressed : t.uncompressed;
    }
    return '';
  }, [allowWave, mimeType, t.compressed, t.uncompressed]);

  const failureMessage = () => {
    if (getGlobal('offline')) {
      return ts.NoSaveOffline;
    }

    // If desktop had a failure
    if (isElectron) return ts.mediaQueuedForUpload;
    // If web had a failure
    else return `${ts.NoSaveWoMedia} ${ts.NoSaveStayOnPage}`;
  };

  useEffect(() => {
    if (mediaId !== mediaState.id) fetchMediaUrl({ id: mediaId ?? '' });
    // Keyed on mediaId only: refetch when the take to show changes, not when
    // mediaState (which this fetch itself updates) or fetchMediaUrl's identity
    // changes, which would re-request the URL in a loop.
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

  useEffect(() => {
    setExtension(mimeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mimeType, extensions, mimes]);

  useEffect(() => {
    if (!recording && filechanged) {
      setPendingSave(true);
    }
  }, [recording, filechanged]);

  const reportHeaderError = useCallback(
    (error: Error) => {
      logError(
        Severity.error,
        reporter,
        infoMsg(error, 'wav header read failed')
      );
    },
    [reporter]
  );

  const {
    sizeStatus,
    sizeBlocksSave,
    sizeWarning,
    estimatedBytes,
    limitBytes,
    rejectionMessage,
    rejectTake,
    clearRejection,
  } = useRecordSizeLimit({
    audioBlob,
    recording,
    waveformDuration,
    saveAsWav,
    sizeLimit,
    overTemplate: t.toobig,
    warnTemplate: t.toobigwarn,
    afterCompressionTemplate: t.tooBigAfterCompression,
    compressFailedTemplate: t.compressErrorTooBig,
    onHeaderError: reportHeaderError,
  });

  const reset = () => {
    clearRejection();
    setFilechanged(false);
    setPendingSave(false);
    setWaveformDuration(0);
    setProcessingRecording(false);
    setOriginalBlob(undefined);
    setAudioBlob(undefined);
    clearCompleted(toolId);
  };

  // MediaRecord owns its own useMediaUpload instance (in useRecordSave; a
  // recorded take uploads there, not through the parent's instance). That is
  // why two callback shapes exist: the record path reports per-item via
  // `afterUploadCb(mediaId)`, while the parent's batch/upload path reports via
  // `finish(ids)`. Hosts that mix both (ProvideRights, PassageDetailItem) write
  // a thin adapter between the two — see useMediaUpload's IMediaUploadProps.
  //
  // TODO cleanup in next PR: retire the host-facing `afterUploadCb` in favor of `finish`.
  // Both now receive keyMap-resolvable ids (useMediaUpload pulls each mediafile
  // before `afterUploadCb`), so consolidating would just remove the two callback
  // shapes and the host adapters above. The hosts' unresolved-id fallbacks
  // (remoteIdGuid-or-fallback, useTitleSave's waitForIt) are now belt-and-braces
  // and could go with it. MediaRecord's own `onUploaded` stays either way — it's
  // internal per-take state, not host work.
  // TODO cleanup: (claude thinks we should do this, I'm not sure it will be as simple
  // as claude thinks, but don't have time to look into it now)
  // MediaRecord runs its own upload pipeline, separate from its
  // host's (e.g. ResourceRecordPanel already holds the upload tab's `uploadMethod`).
  // That's why pendingRestore/beforeUpload/finish/afterUploadCb/uploadType are all
  // threaded through here just to feed this copy, and why the record and upload
  // tabs drifted (this hardcoded Media until the general-resource Retry fix).
  // Consider taking the host's upload function instead, keeping only the per-take
  // bookkeeping (onUploaded) local, and dropping those pass-through props.
  const onUploaded = async (
    mediaId: string,
    submittedBlob: Blob | undefined
  ) => {
    // Notify before any setState: canSave goes true again on the next commit,
    // and auto-save parents must already know this take was rejected or they
    // would retry it on that rising edge (TT-7583).
    if (!mediaId) onSaveRejected?.();
    // The take this id points at is already in the waveform, so the mediaId
    // change it triggers must not blank it and fetch it back (TT-7609).
    if (mediaId) loadRequestedIdRef.current = mediaId;
    setPendingSave(false);
    if (filechangedRef.current && mediaId) setFilechanged(false);
    if (!mediaId) {
      // isElectron means the take was written to disk and queued for retry
      // rather than lost, so it must not be submitted a second time (TT-7365).
      setQueuedTake(isElectron ? submittedBlob : undefined);
      const message = failureMessage();
      showMessage(message);
      setStatusText(message);
      // Electron queue is a successful local save, not a tool saveError.
      // Passing the queue text into saveCompleted left global `saveResult` as
      // `"…Teams screen.;"` (UnsavedContext appends `;`), which survived a
      // trip to Teams and was re-snacked by PassageDetailContext on Record
      // remount while already online (TT-7720).
      saveCompleted(toolId, isElectron ? undefined : message);
    } else {
      setQueuedTake(undefined);
      setStatusText(getCompressedStatusMessage());
      saveCompleted(toolId);
    }
    await afterUploadCb(mediaId);
  };

  const { inFlight } = useRecordSave({
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
    mediaError: ts.mediaError,
    noSaveWoMedia: ts.NoSaveWoMedia,
    compressing: t.compressing,
    compressError: t.compressError,
    saving: t.saving,
    reporter,
    onSaving,
    onReady,
    onSaveRejected,
    onUploaded,
    upload: {
      fields: {
        artifactId,
        passageId,
        sourceMediaId,
        sourceSegments,
        performedBy,
        localPlanId: planId,
        topic,
        languagebcp47,
      },
      uploadType,
      pendingRestore,
      // `finish` fires after the pull (resolvable ids); `afterUploadCb` per item
      // before it. Hosts needing to mutate the new mediafile pass `finish`.
      finish,
      beforeUpload,
    },
    saveRequested,
    saveCompleted,
    clearRequested,
    setStatusText,
    setDoReset,
    showMessage,
    rejectTake,
    reset,
  });

  const loading = loadBusy || inFlight;
  const mediaSaveInProgress = saveRequested(toolId) || inFlight;

  // Update MIME type when tool settings change
  useEffect(() => {
    const newMimeType = getMimeTypeFromSettings();
    setMimeType(newMimeType);
    // Show status message if allowWave is true but using compressed format
    // Only update if not currently showing a temporary status (saving, compressing, etc.)
    if (!inFlight) {
      setStatusText(getCompressedStatusMessage());
    }
  }, [
    getMimeTypeFromSettings,
    setStatusText,
    inFlight,
    getCompressedStatusMessage,
  ]);

  const wantsSaveVisible = useMemo(
    () =>
      waveformDuration > 0 &&
      !inFlight &&
      !recording &&
      (pendingSave || filechanged),
    [filechanged, waveformDuration, inFlight, recording, pendingSave]
  );

  const showProcessingRecordingMessage = useMemo(
    () =>
      !recording &&
      !inFlight &&
      (processingRecording ||
        (wantsSaveVisible && !blobReady && waveformDuration > 0)),
    [
      recording,
      inFlight,
      processingRecording,
      wantsSaveVisible,
      blobReady,
      waveformDuration,
    ]
  );

  const alreadyQueued = audioBlob !== undefined && audioBlob === queuedTake;
  // There are unsaved changes ready to save.
  const needsSave =
    wantsSaveVisible &&
    blobReady &&
    waveformDuration > 0 &&
    !sizeBlocksSave &&
    !alreadyQueued;
  // A usable take is loaded in the waveform: the same readiness as needsSave
  // but without the unsaved-changes gate, so it stays true after the take has
  // uploaded.
  const hasTake =
    waveformDuration > 0 &&
    blobReady &&
    !sizeBlocksSave &&
    !inFlight &&
    !recording;

  // TODO cleanup in next PR: this effect only copies needsSave up to hosts that
  // pass setCanSave, which CODING_STANDARDS "Effects" calls a finding. Move
  // those hosts to useMediaRecord + MediaRecordView so they read needsSave
  // during their own render (as ResourceRecordPanel does), then drop this.
  useEffect(() => {
    setCanSave?.(needsSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wantsSaveVisible,
    blobReady,
    processingRecording,
    sizeBlocksSave,
    recording,
    toolsChanged,
    waveformDuration,
    audioBlob,
    queuedTake,
  ]);

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
    setAudioBlob(b);
  };

  useEffect(() => {
    if (loadBusy && blobReady && originalBlob) {
      loadInFlightRef.current = false;
      setLoadBusy(false);
      if (!inFlight) setStatusText('');
    }
  }, [loadBusy, blobReady, originalBlob, inFlight, setStatusText]);
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
    setLoadBusy(false);
    setStatusText('');
  };
  const stopLoading = () => {
    loadInFlightRef.current = false;
    setLoadBusy(false);
    setStatusText('');
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
    [ts.mediaError, showMessage]
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
    setLoadBusy(true);
    // No status text here: setLoadBusy(true) already puts the "Loading..."
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
        infoMsg(toError(error), 'media load failed')
      );
      blobError(ts.mediaError);
    }
  };

  useEffect(() => {
    if ((preload ?? 0) > 0 && !loading) {
      // handleLoadAudio reports its own failure and clears loading.
      void handleLoadAudio();
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
      // handleLoadAudio reports its own failure and clears loading.
      void handleLoadAudio();
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
    // handleLoadAudio reports its own failure and clears loading.
    void handleLoadAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mediaId]);

  return {
    simplified,
    effectiveOneTryOnly,
    effectiveIsStopLogic,
    captureAudioProcessing,
    loading,
    mediaSaveInProgress,
    originalBlob,
    waveformDuration,
    processingRecording,
    blobReady,
    sizeBlocksSave,
    sizeWarning,
    estimatedBytes,
    wantsSaveVisible,
    showProcessingRecordingMessage,
    needsSave,
    hasTake,
    onBlobReady,
    myOnRecording,
    setFilechanged,
    setProcessingRecording,
    setBlobReady,
    handleWaveformDuration,
    handleWaveformLoadError,
    handleRecordingCleared,
    gotTheBlob,
  };
}

export type MediaRecordState = ReturnType<typeof useMediaRecord>;
