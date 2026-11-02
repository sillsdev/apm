import { shallowEqual, useSelector } from 'react-redux';
import { Box, Stack } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { InsertDriveFileOutlined } from '@mui/icons-material';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getVernacularMediaRec,
  MediaSt,
  related,
  remoteIdGuid,
  useFetchMediaUrl,
} from '../../crud';
import { isAutosaveMedia, isAutosavePending } from '../../crud/autosaveMedia';
import { usePassageAudioSave } from './usePassageAudioSave';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useStepTool } from '../../crud/useStepTool';
import {
  parseRecordCaptureAudioProcessing,
  parseRecordSaveAsWav,
} from '../../crud/useWavRecorder';
import { useSnackBar } from '../../hoc/SnackBar';
import { AudioPlayer, AudioPlayerHandle } from '../AudioPlayer';
import { UnsavedContext } from '../../context/UnsavedContext';
import Uploader from '../Uploader';
import { Button } from '../../control';
import BigDialog from '../../hoc/BigDialog';
import VersionDlg from '../AudioTab/VersionDlg';
import { usePassageVernacularVersionCount } from '../AudioTab/usePassageVersionAudioRows';
import SpeakerName from '../SpeakerName';
import { mediaTabSelector, sharedSelector } from '../../selector';
import { loadBlobAsync } from '../../utils';
import { RecordKeyMap, RecordTransformBuilder } from '@orbit/records';
import { useStepPermissions } from '../../utils/useStepPermission';
import { isLinkedNote } from '../../crud/isLinkedNote';
import Confirm from '../AlertDialog';
import {
  clearPendingUploads,
  hasPendingUploadForPassage,
  pendingUploadIds,
} from '../../store/upload/pendingMediaUploads';
import { IMediaTabStrings, ISharedStrings } from '../../model';

const SaveWait = 500;

export function PassageDetailRecord() {
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const mt: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const {
    startSave,
    saveCompleted,
    toolChanged,
    toolsChanged,
    saveRequested,
    clearRequested,
    clearCompleted,
    waitForSave,
  } = useContext(UnsavedContext).state;
  const [reporter] = useGlobal('errorReporter');
  const [plan] = useGlobal('plan'); //will be constant here
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [memory] = useGlobal('memory');
  const keyMap = memory?.keyMap as RecordKeyMap;
  const [, setBigBusy] = useGlobal('importexportBusy');
  const {
    passage,
    sharedResource,
    mediafileId,
    recording,
    currentstep,
    isBoldWorkflow,
    setStepComplete,
    stepComplete,
  } = usePassageDetailContext();
  const { showMessage } = useSnackBar();
  const toolId = 'RecordTool';

  const { settings: toolSettings } = useStepTool(currentstep);
  const { echoCancellation, noiseSuppression } =
    parseRecordCaptureAudioProcessing(toolSettings);
  const saveAsWav = parseRecordSaveAsWav(toolSettings);

  const [uploadVisible, setUploadVisible] = useState(false);
  const [versionVisible, setVersionVisible] = useState(false);
  const [pendingUploadWarning, setPendingUploadWarning] = useState<
    'upload' | 'record'
  >();
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  // Audio of the passage's latest stored version (autosave or permanent).
  const [savedBlob, setSavedBlob] = useState<Blob>();
  // Audio in the player.
  const [currentBlob, setCurrentBlob] = useState<Blob | null>();
  const [speaker, setSpeaker] = useState('');

  const passageId = useMemo(
    () => related(sharedResource, 'passage') ?? passage.id,
    [sharedResource, passage]
  );
  const vernacularVersionCount = usePassageVernacularVersionCount(passageId);

  const { canDoVernacular } = useStepPermissions();
  const edited = !!currentBlob && currentBlob !== savedBlob;
  const isLatestAutosave = isAutosaveMedia(
    getVernacularMediaRec(passageId, memory)
  );
  const canSave = edited || (!!currentBlob && isLatestAutosave);
  const busy = saveRequested(toolId);
  const canRecord =
    canDoVernacular(related(passage, 'section')) &&
    !isLinkedNote(passage, sharedResource);

  const { save } = usePassageAudioSave({
    passageId,
    currentBlob,
    edited,
    enabled: canRecord && !recording && !busy,
    performedBy: speaker,
    mimeType: saveAsWav ? 'audio/wav' : undefined,
    onStored: (blob) =>
      setSavedBlob((prev) => (prev === savedBlob ? blob : prev)),
  });

  useEffect(() => {
    if (!busy) toolChanged(toolId, edited);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited, busy]);

  useEffect(() => {
    if (!saveRequested(toolId)) {
      if (clearRequested(toolId)) clearCompleted(toolId);
      return;
    }
    void save().then(
      () => saveCompleted(toolId),
      () => saveCompleted(toolId, ts.NoSaveWoMedia)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  // `stale` drops audio that arrives after the user moved to another passage.
  const showBlob = (url: string, stale = () => false) =>
    loadBlobAsync(url)
      .then((blob) => {
        if (stale()) return;
        if (!blob) throw new Error(ts.mediaError);
        setSavedBlob(blob);
        setCurrentBlob(blob);
      })
      .catch(() => {
        if (stale()) return;
        setBigBusy(false);
        showMessage(ts.mediaError);
      });

  const loadLatest = () => {
    const mediaFile = getVernacularMediaRec(passageId, memory);
    if (mediaFile?.attributes?.performedBy)
      setSpeaker(mediaFile.attributes.performedBy);
    if (mediaFile) setBigBusy(true);
    // fetchMediaUrl skips an id it already has.
    if (mediaFile?.id === mediaState.id) void showBlob(mediaState.url);
    else fetchMediaUrl({ id: mediaFile?.id ?? '' });
  };

  useEffect(() => {
    loadLatest();
    return () => setBigBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mediaState.status === MediaSt.ERROR) {
      setBigBusy(false);
      showMessage(mediaState.error || ts.mediaError);
      return;
    }
    if (mediaState.status !== MediaSt.FETCHED || !mediaState.url) return;

    let stale = false;
    void showBlob(mediaState.url, () => stale);
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState]);

  const markCompleteForBold = () => {
    if (isBoldWorkflow && !stepComplete(currentstep))
      void setStepComplete(currentstep, true);
  };

  const hasPendingUpload = () =>
    hasPendingUploadForPassage({
      ...pendingUploadIds(keyMap, plan, passageId),
      artifactTypeId: null,
    });

  const startRecording = async () => {
    clearPendingUploads(keyMap, plan, passageId);
    try {
      await playerRef.current?.startRecording();
    } catch {
      showMessage(
        'Could not access microphone. Please allow microphone access and try again.'
      );
    }
  };

  const pendingUploadWarningClosed = (confirm: boolean) => () => {
    if (confirm) {
      if (pendingUploadWarning === 'upload') setUploadVisible(true);
      else void startRecording();
    }
    setPendingUploadWarning(undefined);
  };

  const afterUpload = async (_: string, mediaRemoteIds?: string[]) => {
    const id =
      mediaRemoteIds && mediaRemoteIds.length > 0
        ? remoteIdGuid('mediafile', mediaRemoteIds[0], keyMap) ||
          mediaRemoteIds[0]
        : undefined;
    if (id) {
      clearPendingUploads(keyMap, plan, passageId);
      loadLatest();
      markCompleteForBold();
    }
    playerRef.current?.setTime(0);
  };

  const handleVersionApplied = () => {
    clearPendingUploads(keyMap, plan, passageId, isAutosavePending);
    loadLatest();
  };

  const saveIfChanged = (cb: () => void) => {
    if (canSave) {
      startSave(toolId);
      waitForSave(cb, SaveWait).catch((err: Error) => showMessage(err.message));
    } else cb();
  };

  async function handleRecordToggle() {
    if (busy || !speaker) return;

    if (!recording) {
      if (selection) {
        showMessage(
          'Recording is not supported while there is a selected time range.'
        );
        return;
      }
      if (hasPendingUpload()) setPendingUploadWarning('record');
      else await startRecording();
    } else {
      playerRef.current?.stopRecording();
    }
  }

  const handleUpload = () => {
    saveIfChanged(() => {
      if (hasPendingUpload()) setPendingUploadWarning('upload');
      else setUploadVisible(true);
    });
  };

  const handleAudioChange = (audio: Blob | null) => {
    setCurrentBlob(audio);
    if (audio) markCompleteForBold();
    else {
      clearPendingUploads(keyMap, plan, passageId, isAutosavePending);
      if (isBoldWorkflow) {
        setStepComplete(currentstep, false);
        memory.update((tr: RecordTransformBuilder) =>
          tr.removeRecord({ type: 'mediafile', id: mediafileId }).toOperation()
        );
      }
    }
  };

  return (
    <Stack sx={{ px: 1, pb: 1 }}>
      <Box sx={{ py: 1 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ width: '100%', minWidth: 0 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SpeakerName
              name={speaker}
              onChange={setSpeaker}
              disabled={!canRecord}
              aiip={false}
            />
          </Box>
          {canRecord && (
            <Button
              id="pdRecordLoadFile"
              title={ts.loadFromFile}
              sx={{ flexShrink: 0 }}
              startIcon={<FolderOpenOutlinedIcon />}
              disabled={recording}
              onClick={handleUpload}
            >
              {ts.loadFromFile}
            </Button>
          )}
        </Stack>
      </Box>
      <AudioPlayer
        ref={playerRef}
        audioSource={currentBlob ?? undefined}
        height={80}
        label="record"
        enableDragSelection
        allowRecord
        captureEchoCancellation={echoCancellation}
        captureNoiseSuppression={noiseSuppression}
        showCut={!isBoldWorkflow}
        showTrash
        onReady={() => setBigBusy(false)}
        onAudioChange={handleAudioChange}
        onSelectionChange={(sel) => setSelection(sel)}
      />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          py: 1,
        }}
      >
        <Box>
          {!isBoldWorkflow && vernacularVersionCount > 1 && (
            <Button
              id="pdRecordVersions"
              title={ts.versionHistory}
              startIcon={<InsertDriveFileOutlined />}
              disabled={recording}
              onClick={() => setVersionVisible(true)}
            >
              {ts.versionHistory}...
            </Button>
          )}
        </Box>
        {currentBlob && (
          <Button
            disabled={!canSave || recording}
            onClick={() => startSave(toolId)}
          >
            {ts.save}
          </Button>
        )}
      </Box>

      {/* Record */}
      {canRecord && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 40,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            py: 4,
          }}
        >
          {!mediafileId || !recording ? (
            <Box
              role="button"
              aria-label="record"
              onClick={handleRecordToggle}
              sx={{
                width: 80,
                height: 80,
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: recording ? 'none' : '25px solid',
                borderColor: speaker ? 'alert.main' : '#d0d0d0',
                bgcolor: recording ? 'alert.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: speaker && !busy ? 'pointer' : 'default',
                opacity: speaker && !busy ? 1 : 0.6,
                transition: 'all 0.2s ease',
                '&:hover': speaker && !busy ? { opacity: 0.85 } : {},
              }}
            >
              {recording && <StopIcon sx={{ color: '#fff', fontSize: 36 }} />}
            </Box>
          ) : (
            <Button
              onClick={handleRecordToggle}
              sx={{
                width: 120,
                height: 64,
                fontSize: '1.1rem !important',
                fontWeight: 600,
                color: selection ? '#9e9e9e' : 'alert.main',
                opacity: speaker && !busy ? 1 : 0.6,
                cursor: speaker && !busy ? 'pointer' : 'default',

                '&:hover':
                  speaker && !busy && !selection ? {} : { bgcolor: '#fff' },
              }}
            >
              <PauseIcon sx={{ fontSize: 32 }} />
            </Button>
          )}
        </Box>
      )}

      <Uploader
        isOpen={uploadVisible}
        onOpen={setUploadVisible}
        showMessage={showMessage}
        multiple={false}
        finish={afterUpload}
        cancelled={useRef(false)}
        passageId={passageId}
        performedBy={speaker}
        onSpeakerChange={setSpeaker}
        skipImportExportWait
      />

      <BigDialog
        title={ts.versionHistory}
        isOpen={versionVisible}
        onOpen={setVersionVisible}
      >
        <VersionDlg
          passId={passageId}
          canSetDestination={false}
          hasPublishing={false}
          close={() => setVersionVisible(false)}
          onVersionApplied={handleVersionApplied}
        />
      </BigDialog>

      {pendingUploadWarning && (
        <Confirm
          text={mt.pendingUploadExistsWarn}
          yesResponse={pendingUploadWarningClosed(true)}
          noResponse={pendingUploadWarningClosed(false)}
        />
      )}
    </Stack>
  );
}

export default PassageDetailRecord;
