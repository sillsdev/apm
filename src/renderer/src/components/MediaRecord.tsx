import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
} from 'react';
import { useGlobal } from '../context/useGlobal';
import { IState, IPassageRecordStrings, ISharedStrings } from '../model';
import * as actions from '../store';
import { Stack, Paper, Typography } from '@mui/material';
import WSAudioPlayer from './WSAudioPlayer';
import { generateUUID, loadBlobAsync, waitForIt } from '../utils';
import {
  IMediaState,
  MediaSt,
  useFetchMediaUrl,
  useMediaUpload,
  convertToWebM,
} from '../crud';
import { useSnackBar } from '../hoc/SnackBar';
import { UnsavedContext } from '../context/UnsavedContext';
import { SIZELIMIT } from './MediaUpload';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { useStepTool } from '../crud/useStepTool';
import { JSONParse } from '../utils';
import { UploadType } from './UploadType';
import { shallowEqual, useSelector } from 'react-redux';
import { passageRecordSelector, sharedSelector } from '../selector';
import { useDispatch } from 'react-redux';

interface IProps {
  toolId: string;
  artifactId: string | null;
  passageId: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  topic?: string | undefined;
  keepItSmall?: boolean | undefined;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  onReady?: (() => void) | undefined;
  onSaving?: (() => void) | undefined;
  onRecording?: ((r: boolean) => void) | undefined;
  onPlayStatus?: ((p: boolean) => void) | undefined;
  mediaId?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  defaultFilename: string;
  allowDeltaVoice?: boolean | undefined;
  setCanSave: (canSave: boolean) => void;
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
    artifactId,
    passageId,
    planId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    topic,
    afterUploadCb,
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
    width,
    keepItSmall,
  } = props;
  const context = usePassageDetailContext();
  const { settings: toolSettings } = useStepTool(context?.currentstep || '');
  const t: IPassageRecordStrings = useSelector(passageRecordSelector);
  const convert_status = useSelector(
    (state: IState) => state.convertBlob.statusmsg
  );
  const convert_complete = useSelector(
    (state: IState) => state.convertBlob.complete
  );
  const convert_blob = useSelector((state: IState) => state.convertBlob.blob);
  const convert_guid = useSelector((state: IState) => state.convertBlob.guid);
  const dispatch = useDispatch();
  const convertBlob = (audioBlob: Blob, mimeType: string, guid: string) =>
    dispatch(actions.convertBlob(audioBlob, mimeType, guid) as any);
  const resetConvertBlob = () => dispatch(actions.resetConvertBlob() as any);
  const WARNINGLIMIT = 1;
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const mediaStateRef = useRef(mediaState);
  const mediaStateFetchedTimeRef = useRef<number>(0);
  const [filetype, setFiletype] = useState('');
  const [originalBlob, setOriginalBlob] = useState<Blob>();
  const [audioBlob, setAudioBlob] = useState<Blob>();
  const [loading, setLoading] = useState(false);
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
  const guidRef = useRef('');
  const extensions = useMemo(
    () => ['mp3', 'mp3', 'webm', 'mka', 'm4a', 'wav', 'ogg'],
    []
  );
  const sizeLimit = SIZELIMIT(UploadType.Media);
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

  const getCompressedStatusMessage = useCallback(() => {
    if (allowWave) {
      return mimeType !== 'audio/wav' ? t.compressed : t.uncompressed;
    }
    return '';
  }, [allowWave, mimeType, t.compressed, t.uncompressed]);

  const myAfterUploadCb = async (mediaId: string) => {
    setUploading(false);
    if (filechangedRef.current && mediaId) setFilechanged(false);
    if (!mediaId) {
      showMessage(ts.NoSaveWoMedia);
      setStatusText(ts.NoSaveWoMedia);
      saveCompleted(toolId, ts.NoSaveWoMedia);
    } else {
      // Restore compressed status message if applicable
      setStatusText(getCompressedStatusMessage());
      saveCompleted(toolId);
    }
    afterUploadCb(mediaId);
    saveRef.current = false;
  };

  const uploadMedia = useMediaUpload({
    artifactId,
    passageId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    planId,
    topic,
    afterUploadCb: myAfterUploadCb,
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
    setCanSave(
      blobReady &&
        !tooBig &&
        filechanged &&
        !converting &&
        !uploading &&
        !recording &&
        !saveRef.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    blobReady,
    tooBig,
    filechanged,
    converting,
    uploading,
    recording,
    toolsChanged,
  ]);

  useEffect(() => {
    if (setCanCancel) setCanCancel(!converting && !uploading);
  }, [converting, uploading, setCanCancel]);

  const doUpload = useCallback(
    async (blob: Blob) => {
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
    [defaultFilename, filetype, mimeType, uploadMedia]
  );

  useEffect(() => {
    //was it me who asked for this?
    if (convert_guid === guidRef.current) {
      if (convert_status) {
        const progress = parseInt(convert_status);
        if (isNaN(progress)) {
          showMessage(convert_status);
        } else {
          setStatusText(t.compressing.replace('{0}', progress.toString()));
        }
      }
      if (convert_complete) {
        if (convert_blob)
          doUpload(convert_blob).then(() => {
            convertComplete();
          });
        else {
          convertComplete();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convert_status, convert_complete, convert_blob]);

  const convertComplete = () => {
    resetConvertBlob();
    setConverting(false);
    if (onReady) onReady();
  };
  useEffect(() => {
    const limit = sizeLimit * compression;
    const big = (audioBlob?.size ?? 0) > limit * 1000000;
    setTooBig(big);
    if (audioBlob && audioBlob.size > (limit - WARNINGLIMIT) * 1000000)
      setWarning(
        (big ? t.toobig : t.toobigwarn).replace('{1}', limit.toString())
      );
    else setWarning('');

    if (saveRequested(toolId)) {
      if (!saveRef.current) {
        if (audioBlob) {
          onSaving && onSaving();
          saveRef.current = true;
          if (mimeType !== 'audio/wav') {
            setConverting(true);
            if (mimeType === 'audio/ogg;codecs=opus') {
              guidRef.current = generateUUID();
              waitForIt(
                'previous convert',
                () => convert_guid === '',
                () => false,
                300
              ).then(() => convertBlob(audioBlob, mimeType, guidRef.current));
            } else {
              convertToWebM(audioBlob).then((convert_blob) =>
                doUpload(convert_blob).then(() => {
                  convertComplete();
                })
              );
            }
          } else {
            doUpload(audioBlob).then(() => {
              onReady && onReady();
            });
          }
          return;
        } else {
          saveCompleted(toolId);
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
  }, [audioBlob, toolsChanged, mimeType, convert_guid, toolId]);

  const setExtension = (mimeType: string) => {
    if (mimeType) {
      const i = mimes.findIndex((m) => m === mimeType);
      if (i >= 0) setFiletype(extensions[i] ?? '');
    }
  };

  function onBlobReady(blob: Blob | undefined) {
    setAudioBlob(blob);
    setFilechanged(true);
  }
  function myOnRecording(r: boolean) {
    setRecording(r);
    if (onRecording) onRecording(r);
  }
  useEffect(() => {
    if (doReset) {
      reset();
      setDoReset && setDoReset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doReset]);

  const reset = () => {
    setFilechanged(false);
    setOriginalBlob(undefined);
    setAudioBlob(undefined);
    clearCompleted(toolId);
  };

  const gotTheBlob = (b: Blob) => {
    setOriginalBlob(b);
    setLoading(false);
    onLoaded && onLoaded();
    setAudioBlob(b);
  };
  const blobError = (urlorError: string) => {
    showMessage(urlorError);
    setLoading(false);
    onLoaded && onLoaded();
  };
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
    showMessage(t.loading);
    if (loading || !mediaId) return;
    setLoading(true);
    reset();

    const url = await getGoodUrl();

    if (url) {
      try {
        const blob = await loadBlobAsync(url);
        if (blob) gotTheBlob(blob);
        else blobError('Failed to load blob');
      } catch (error) {
        blobError(
          error instanceof Error ? error.message : 'Failed to load blob'
        );
      }
    } else {
      blobError(mediaStateRef.current.error || 'Failed to fetch media URL');
    }
  };

  useEffect(() => {
    if ((preload ?? 0) > 0 && !loading) {
      handleLoadAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  const segments = '{}';

  return (
    <Paper id="mediaRecord" sx={{ width: width }}>
      <WSAudioPlayer
        allowRecord={allowRecord !== false}
        allowZoom={allowZoom}
        allowDeltaVoice={allowDeltaVoice}
        oneTryOnly={oneTryOnly}
        width={width - 20}
        height={height || 300}
        blob={originalBlob}
        onBlobReady={onBlobReady}
        setChanged={setFilechanged}
        setBlobReady={setBlobReady}
        onRecording={myOnRecording}
        onPlayStatus={onPlayStatus}
        doReset={doReset}
        autoStart={autoStart}
        segments={segments}
        reload={gotTheBlob}
        noNewVoice={noNewVoice}
        allowNoNoise={allowNoNoise}
        keepItSmall={keepItSmall}
      />
      {warning && (
        <Typography sx={{ m: 2, color: 'warning.dark' }} id="warning">
          {warning}
        </Typography>
      )}
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <Typography sx={{ mr: 3 }} id="size">
          {`${((audioBlob?.size ?? 0) / 1000000 / compression).toFixed(2)}MB`}
        </Typography>
        {metaData}
      </Stack>
    </Paper>
  );
}
export default MediaRecord;
