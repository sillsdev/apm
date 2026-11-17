import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  DialogActions,
  DialogContent,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
import MediaUploadContent from '../../MediaUploadContent';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IPassageDetailArtifactsStrings,
  IPassageRecordStrings,
} from '../../../model';
import { passageRecordSelector, resourceSelector } from '../../../selector';
import UploadRecordToggle, { AudioAddMode } from './UploadRecordToggle';
import { UploadType } from '../../UploadType';
import { getRefWidth } from '../../../utils/getRefWidth';
import { MediaRecordView } from '../../MediaRecord';
import { useMediaRecord } from '../../useMediaRecord';
import { UnsavedContext } from '../../../context/UnsavedContext';
import SpeakerName from '../../SpeakerName';
import { Button } from '../../../control';
import Busy from '../../Busy';
import { useResourceUploadContext } from './ResourceUploadContext';

const RECORD_TOOL_ID = 'PassageRecord';

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  display: 'block',
  // Typography's gutterBottom margin (a prop, not a CSS key, so set it here).
  marginBottom: '0.35em',
}));

// Everything else comes from ResourceUploadContext; these two are built by
// ResourceUploadStep itself.
export interface IResourceRecordPanelProps {
  // The Upload tab's useMediaUpload instance (owned by ResourceUploadStep).
  uploadMethod:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  // The recorder's finish: the wizard's finish, wrapped to set `cancelled`.
  finish: (mediaRemoteIds?: string[]) => Promise<void>;
}

/** The add-resource wizard's Upload | Record body for audio resources. */
export function ResourceRecordPanel({
  uploadMethod,
  finish,
}: IResourceRecordPanelProps) {
  const {
    ready,
    metaData,
    speaker,
    onSpeaker,
    onFiles,
    uploadType,
    validationMessage,
    deferred,
  } = useResourceUploadContext();
  const onNext = deferred?.onNext;
  const controlsRef = deferred?.controlsRef;
  const resourceStrings: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const { startSave } = useContext(UnsavedContext).state;
  const [mode, setMode] = useState<AudioAddMode>(AudioAddMode.Upload);
  // For blocking switch to Upload tab while
  // recording is in progress
  const [isRecording, setIsRecording] = useState(false);

  const handleMode = (nextMode: AudioAddMode) => {
    if (isRecording && nextMode === AudioAddMode.Upload) return;
    if (nextMode === AudioAddMode.Record) {
      onFiles?.([]);
      setIsRecording(false);
    }
    setMode(nextMode);
  };

  const primaryButtonText = deferred ? resourceStrings.next : undefined;

  // For the wizard to upload the retained/deferred take while this panel is
  // hidden (it stays mounted)
  useEffect(() => {
    if (controlsRef && mode === AudioAddMode.Record) {
      controlsRef.current.handleAddOrSave = () => startSave(RECORD_TOOL_ID);
    }
  }, [mode, controlsRef, startSave]);

  return (
    <>
      <UploadRecordToggle
        mode={mode}
        onMode={handleMode}
        disableUpload={isRecording}
      />
      {mode === AudioAddMode.Record ? (
        <ResourceRecordTab
          finish={finish}
          primaryButtonText={primaryButtonText}
          setIsRecording={setIsRecording}
        />
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          uploadType={uploadType}
          primaryButtonText={primaryButtonText}
          onNext={onNext}
          controlsRef={controlsRef}
          multiple
          uploadMethod={uploadMethod}
          metaData={metaData}
          ready={ready}
          speaker={speaker}
          onSpeaker={uploadType === UploadType.Media ? onSpeaker : undefined}
          onFiles={onFiles}
          keepFilesAfterSubmit={Boolean(deferred)}
          validationMessage={validationMessage}
        />
      )}
    </>
  );
}

interface IResourceRecordTabProps {
  finish: (mediaRemoteIds?: string[]) => Promise<void>;
  primaryButtonText: string | undefined;
  setIsRecording: (isRecording: boolean) => void;
}

/**
 * The Record tab's body. Mounted only while that tab is shown, so its state
 * (and the recorder's) starts fresh each time the user switches to it. It owns
 * the recorder's state through useMediaRecord, so the button reads needsSave
 * and hasTake during this render instead of MediaRecord copying them up.
 */
function ResourceRecordTab({
  finish,
  primaryButtonText,
  setIsRecording,
}: IResourceRecordTabProps) {
  const {
    active,
    artifactId,
    defaultFilename,
    ready,
    metaData,
    speaker,
    onSpeaker,
    uploadType,
    pendingRestore,
    beforeUpload,
    deferred,
    onStartRecording,
  } = useResourceUploadContext();
  const onNext = deferred?.onNext;
  const recordStrings: IPassageRecordStrings = useSelector(
    passageRecordSelector,
    shallowEqual
  );
  const { startSave } = useContext(UnsavedContext).state;
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  // Trust a preselected speaker (may have been a rights "Do later")
  const [hasRights, setHasRights] = useState(Boolean(speaker?.trim()));
  const [dialogWidth, setDialogWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const rec = useMediaRecord({
    toolId: RECORD_TOOL_ID,
    artifactId,
    passageId: undefined,
    afterUploadCb: async () => {},
    finish,
    mediaId: '',
    onSaving: () => setBusy(true),
    onReady: () => setBusy(false),
    defaultFilename,
    setStatusText,
    onRecording: (recording) => {
      setIsRecording(recording);
      if (recording) onStartRecording?.();
    },
    pendingRestore,
    uploadType,
    beforeUpload,
  });

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(contentRef));
  }, []);

  // TODO cleanup: factor out or at least make consistent the various width
  // and resize detection we do in this codebase. Currently it appears to be
  // necessary for the wavesurfer but I wonder if we could change that.
  useEffect(() => {
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
  }, [active, updateDialogWidth]);

  return (
    <>
      <DialogContent id="recDlgContent" ref={contentRef}>
        {!busy && (
          <SpeakerName
            name={speaker || ''}
            onRights={setHasRights}
            onChange={onSpeaker}
            aiip={false}
          />
        )}
        {busy && <Busy />}
        {/* Box keeps the recorder only as tall as its content to prevent a gap above the record button. */}
        <Box>
          <MediaRecordView
            rec={rec}
            mediaId=""
            hotkeys={active}
            allowRecord={hasRights}
            recordBlocked={!active}
            width={dialogWidth}
            height={160}
            allowZoom={true}
            allowNoNoise={true}
            allowDeltaVoice={true}
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
          disabled={
            busy ||
            ready === false ||
            // In the deferred wizard flow this button advances (onNext) rather
            // than saving, so any usable take counts, including one that
            // already uploaded (which clears needsSave).
            !(onNext ? rec.hasTake : rec.needsSave) ||
            !hasRights
          }
          onClick={onNext ?? (() => startSave(RECORD_TOOL_ID))}
        >
          {primaryButtonText || recordStrings.save}
        </Button>
      </DialogActions>
    </>
  );
}

export default ResourceRecordPanel;
