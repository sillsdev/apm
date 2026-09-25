import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MediaUploadContent from './MediaUploadContent';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IPassageDetailArtifactsStrings,
  IPassageRecordStrings,
} from '../model';
import { passageRecordSelector, resourceSelector } from '../selector';
import UploadRecordToggle, {
  AudioAddMode,
} from './PassageDetail/Internalization/UploadRecordToggle';
import { UploadType } from './UploadType';
import { useGlobal } from '../context/useGlobal';
import { getRefWidth } from '../utils/getRefWidth';
import { useFetchMediaUrl } from '../crud';
import MediaRecord from './MediaRecord';
import { UnsavedContext } from '../context/UnsavedContext';
import SpeakerName from './SpeakerName';
import { Button } from '../control';
import Busy from './Busy';
import Confirm from './AlertDialog';

const audioDlgWidth = 'min(680px, calc(100vw - 32px))';
const audioDlgHeight = 'min(700px, calc(100dvh - 32px))';

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
}));

const RecordDialog = styled(Dialog)(({ theme }) => ({
  flexGrow: 1,
  '& .MuiDialog-paper': {
    width: audioDlgWidth,
    maxWidth: audioDlgWidth,
    minWidth: 0,
    height: audioDlgHeight,
    minHeight: audioDlgHeight,
    maxHeight: audioDlgHeight,
  },
  // Tighten vertical chrome so record mode (speaker + player + metadata)
  // fits without scrolling on typical laptop heights.
  '& .MuiDialogTitle-root': {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(0.5),
  },
  '& .MuiDialogContent-root': {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  '& .MuiDialogActions-root': {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
  },
  '& #uploadCancel, & #uploadSave': {
    margin: theme.spacing(1),
  },
}));

interface IProps {
  visible: boolean;
  onVisible: (visible: boolean) => void;
  onCancel: () => void;
  mediaId: string;
  artifactId: string | null;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  passageId: string | undefined;
  planId?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  defaultFilename: string;
  ready?: (() => boolean) | undefined;
  allowWave?: boolean | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  team?: string | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  uploadType: UploadType;
  uploadMethod:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  multiple?: boolean | undefined;
  inValue?: string | undefined;
  onNonAudio?: ((nonAudio: boolean) => void) | undefined;
  audioOnly?: boolean | undefined;
  validationMessage?: string | undefined;
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  beforeUpload?: (() => Promise<void>) | undefined;
  /** When set, always prompt to confirm before discarding on close (X/backdrop). */
  confirmOnClose?: boolean | undefined;
  /**
   * Forwarded to MediaRecord (the record tab): when set, a saved take is handed
   * here as a staged file rather than uploaded — the deferred general-resource
   * flow. The upload tab stages through `uploadMethod` instead.
   */
  onStageFile?: ((files: File[]) => void | Promise<void>) | undefined;
  /** Pre-select these files on the upload tab (see MediaUploadContent). */
  initialFiles?: File[] | undefined;
  /** Keep the upload-tab selection after submit instead of clearing it (see MediaUploadContent). */
  keepFilesAfterSubmit?: boolean | undefined;
}

function PassageRecordDlg(props: IProps) {
  const {
    visible,
    onVisible,
    mediaId,
    artifactId,
    afterUploadCb,
    passageId,
    planId,
    defaultFilename,
    onCancel,
    ready,
    metaData,
    allowWave,
    speaker,
    onSpeaker,
    team,
    onFiles,
    uploadType,
    uploadMethod,
    multiple,
    inValue,
    onNonAudio,
    audioOnly,
    validationMessage,
    pendingRestore,
    beforeUpload,
    confirmOnClose,
    onStageFile,
    initialFiles,
    keepFilesAfterSubmit,
  } = props;
  const resourceStrings: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const recordStrings: IPassageRecordStrings = useSelector(
    passageRecordSelector,
    shallowEqual
  );
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const { startSave } = useContext(UnsavedContext).state;
  const [mode, setMode] = useState<AudioAddMode>('upload');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  // canCancel value is unused now that the record-mode Cancel button is gone,
  // but MediaRecord still drives the setter.
  const [, setCanCancel] = useState(false);
  const [hasRights, setHasRights] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecordDlg';

  useEffect(() => {
    if (visible) {
      setMode('upload');
      setRecording(false);
      setShowConfirm(false);
    }
  }, [visible]);

  useEffect(() => {
    if (mode === 'record') {
      setBusy(false);
      setStatusText('');
      setCanSave(false);
      setCanCancel(false);
      setHasRights(false);
      setRecording(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'record' && mediaId !== mediaState.id) {
      fetchMediaUrl({ id: mediaId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mediaId]);

  useEffect(() => setBusy(false), [visible]);

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(dialogRef));
  }, []);

  useEffect(() => {
    if (mode !== 'record') return;
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
  }, [mode, visible, updateDialogWidth]);

  const handleCancel = () => {
    if (recording) return;
    onCancel();
    if (!busy) onVisible(false);
  };

  const doClose = () => {
    if (mode === 'record') {
      handleCancel();
    } else {
      onCancel();
    }
  };

  const requestClose = (
    _event?: object,
    reason?: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // outside click should not close dialog
    if (reason === 'backdropClick') return;
    // Can't close mid-recording (matches handleCancel's own guard).
    if (recording) return;
    // Always confirm first: this is a wizard step and closing discards it.
    if (confirmOnClose) {
      setShowConfirm(true);
      return;
    }
    doClose();
  };

  const handleMode = (nextMode: AudioAddMode) => {
    if (recording && nextMode === 'upload') return;
    // Switching to record abandons any file selection made on the upload tab.
    // Clear it so a stale multi-file general-resource selection can't keep
    // blocking save once the user records instead.
    if (nextMode === 'record') onFiles?.([]);
    setMode(nextMode);
  };

  const handleSpeaker = (nextSpeaker: string) => {
    onSpeaker?.(nextSpeaker);
  };

  const saveText =
    uploadType === UploadType.ProjectResource
      ? resourceStrings.next
      : undefined;

  return (
    <RecordDialog
      open={visible}
      onClose={requestClose}
      aria-labelledby="addAudioDlg"
      disableEnforceFocus
    >
      <DialogTitle
        id="addAudioDlg"
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {resourceStrings.addAudioResource}
        </Box>
        <IconButton
          id="addAudioClose"
          onClick={requestClose}
          sx={{ alignSelf: 'flex-start' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <UploadRecordToggle
        mode={mode}
        onMode={handleMode}
        disableUpload={recording}
      />
      {mode === 'record' ? (
        <>
          <DialogContent id="recDlgContent" ref={dialogRef}>
            {!busy && (
              <SpeakerName
                planId={planId}
                name={speaker || ''}
                onRights={setHasRights}
                onChange={handleSpeaker}
                team={team}
                aiip={false}
              />
            )}
            {busy && <Busy />}
            {/* Content-sized wrapper so WSAudioPlayer's height:100% cannot
                cause vertical growth. May be unnecessary since this dialog
                is not shown on actually mobile screens, but leaving it just in case*/}
            <Box
              sx={{
                flex: '0 0 auto',
                height: 'fit-content',
                width: '100%',
                maxWidth: '100%',
                alignSelf: 'flex-start',
              }}
            >
              <MediaRecord
                toolId={myToolId}
                artifactId={artifactId}
                passageId={passageId}
                planId={planId}
                afterUploadCb={afterUploadCb}
                mediaId={mediaId}
                onSaving={() => setBusy(true)}
                onReady={() => setBusy(false)}
                defaultFilename={defaultFilename}
                allowRecord={hasRights}
                allowWave={allowWave}
                setCanSave={setCanSave}
                setCanCancel={setCanCancel}
                setStatusText={setStatusText}
                width={dialogWidth}
                height={160}
                allowZoom={true}
                allowNoNoise={true}
                allowDeltaVoice={true}
                onRecording={setRecording}
                pendingRestore={pendingRestore}
                beforeUpload={beforeUpload}
                onStageFile={onStageFile}
              />
            </Box>
            {metaData}
          </DialogContent>
          <DialogActions>
            <StatusMessage variant="caption">{statusText}</StatusMessage>
            <Button
              id="rec-save"
              sx={{ m: 1, minWidth: '96px' }}
              color="primary"
              disabled={busy || (ready && !ready()) || !canSave || !hasRights}
              onClick={() => startSave(myToolId)}
            >
              {saveText || recordStrings.save}
            </Button>
          </DialogActions>
        </>
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          onVisible={onVisible}
          uploadType={uploadType}
          saveText={saveText}
          multiple={multiple}
          uploadMethod={uploadMethod}
          cancelMethod={onCancel}
          metaData={metaData}
          ready={ready}
          speaker={speaker}
          // Only Media uploads gate the drop zone on speaker rights (and show
          // SpeakerName). Resource/ProjectResource must leave onSpeaker unset
          // so hasRights stays true and the file drop target is clickable.
          onSpeaker={uploadType === UploadType.Media ? onSpeaker : undefined}
          team={team}
          onFiles={onFiles}
          initialFiles={initialFiles}
          keepFilesAfterSubmit={keepFilesAfterSubmit}
          inValue={inValue}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
        />
      )}
      {showConfirm && (
        <Confirm
          title={resourceStrings.confirmCloseTitle}
          text={resourceStrings.confirmClose}
          no={resourceStrings.keepOpen}
          primaryButton="no"
          yes={resourceStrings.discardAndClose}
          noResponse={() => setShowConfirm(false)}
          yesResponse={() => {
            setShowConfirm(false);
            doClose();
          }}
        />
      )}
    </RecordDialog>
  );
}

export default PassageRecordDlg;
