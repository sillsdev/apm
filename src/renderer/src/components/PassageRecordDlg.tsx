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
import { AltButton, PriButton } from '../control';
import Busy from './Busy';

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
  uploadType: UploadType;
  uploadMethod:
    | ((files: File[]) => void | boolean | Promise<void | boolean>)
    | undefined;
  multiple?: boolean | undefined;
  inValue?: string | undefined;
  onNonAudio?: ((nonAudio: boolean) => void) | undefined;
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
    uploadType,
    uploadMethod,
    multiple,
    inValue,
    onNonAudio,
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
  const [canCancel, setCanCancel] = useState(false);
  const [hasRights, setHasRights] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecordDlg';

  useEffect(() => {
    if (visible) {
      setMode('upload');
      setRecording(false);
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

  const requestClose = (
    _event?: object,
    reason?: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // outside click should not close dialog
    if (reason === 'backdropClick') return;
    if (mode === 'record') {
      handleCancel();
    } else {
      onCancel();
    }
  };

  const handleMode = (nextMode: AudioAddMode) => {
    if (recording && nextMode === 'upload') return;
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
              />
            )}
            {busy && <Busy />}
            {/* Content-sized wrapper so WSAudioPlayer's height:100% cannot
                cause vertical growth. */}
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
              />
            </Box>
            {metaData}
          </DialogContent>
          <DialogActions>
            <StatusMessage variant="caption">{statusText}</StatusMessage>
            <AltButton
              id="rec-cancel"
              onClick={handleCancel}
              disabled={!canCancel || recording}
            >
              {recordStrings.cancel}
            </AltButton>
            <PriButton
              id="rec-save"
              onClick={() => startSave(myToolId)}
              disabled={
                busy || (ready && !ready()) || !canSave || !hasRights
              }
              sx={{ m: 1, minWidth: '96px' }}
            >
              {saveText || recordStrings.save}
            </PriButton>
          </DialogActions>
        </>
      ) : (
        <MediaUploadContent
          noWrapper
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
          onSpeaker={
            uploadType === UploadType.Media ? onSpeaker : undefined
          }
          team={team}
          inValue={inValue}
          onNonAudio={onNonAudio}
        />
      )}
    </RecordDialog>
  );
}

export default PassageRecordDlg;
