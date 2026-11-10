import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  DialogActions,
  DialogContent,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
import MediaUploadContent, {
  MediaUploadControlsRef,
} from './MediaUploadContent';
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
import { getRefWidth } from '../utils/getRefWidth';
import MediaRecord from './MediaRecord';
import { UnsavedContext } from '../context/UnsavedContext';
import SpeakerName from './SpeakerName';
import { Button } from '../control';
import Busy from './Busy';

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
}));

export interface IPassageRecordPanelProps {
  active: boolean;
  artifactId: string | null;
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  metaData?: React.JSX.Element | undefined;
  defaultFilename: string;
  ready?: (() => boolean) | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  uploadType: UploadType;
  uploadMethod:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  validationMessage?: string | undefined;
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  beforeUpload?: (() => Promise<void>) | undefined;
  deferred?: IDeferredUpload | undefined;
  onStartRecording?: (() => void) | undefined;
}

export interface IDeferredUpload {
  onNext: () => void;
  // for the wizard to trigger the real upload later
  submitRef: React.RefObject<MediaUploadControlsRef>;
}

export function PassageRecordPanel(props: IPassageRecordPanelProps) {
  const {
    active,
    artifactId,
    finish,
    defaultFilename,
    ready,
    metaData,
    speaker,
    onSpeaker,
    onFiles,
    uploadType,
    uploadMethod,
    validationMessage,
    pendingRestore,
    beforeUpload,
    deferred,
    onStartRecording,
  } = props;
  const onNext = deferred?.onNext;
  const controlsRef = deferred?.submitRef;
  const resourceStrings: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const recordStrings: IPassageRecordStrings = useSelector(
    passageRecordSelector,
    shallowEqual
  );
  const { startSave } = useContext(UnsavedContext).state;
  const [mode, setMode] = useState<AudioAddMode>(AudioAddMode.Upload);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  // A take is loaded in the waveform (stays true after it has been uploaded).
  const [hasTake, setHasTake] = useState(false);
  const [hasRights, setHasRights] = useState(false);
  // For blocking switch to Upload tab while
  // recording is in progress
  const [isRecording, setIsRecording] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecord';

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(contentRef));
  }, []);

  // TODO cleanup: factor out or at least make consistent the various width
  // and resize detection we do in this codebase. Currently it appears to be
  // necessary for the wavesurfer but I wonder if we could change that.
  useEffect(() => {
    if (mode !== AudioAddMode.Record) return;
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
  }, [mode, active, updateDialogWidth]);

  const handleMode = (nextMode: AudioAddMode) => {
    if (isRecording && nextMode === AudioAddMode.Upload) return;
    if (nextMode === AudioAddMode.Record) {
      onFiles?.([]);
      setBusy(false);
      setStatusText('');
      setCanSave(false);
      // Trust a preselected speaker (may have been a rights "Do later")
      setHasRights(Boolean(speaker?.trim()));
      setIsRecording(false);
    }
    setMode(nextMode);
  };

  const primaryButtonText = deferred ? resourceStrings.next : undefined;

  // For the wizard to upload the retained/deferred take while this panel is
  // hidden (it stays mounted)
  useEffect(() => {
    if (controlsRef && mode === AudioAddMode.Record) {
      controlsRef.current.handleAddOrSave = () => startSave(myToolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, controlsRef]);

  return (
    <>
      <UploadRecordToggle
        mode={mode}
        onMode={handleMode}
        disableUpload={isRecording}
      />
      {mode === AudioAddMode.Record ? (
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
              <MediaRecord
                toolId={myToolId}
                hotkeys={active}
                artifactId={artifactId}
                passageId={undefined}
                afterUploadCb={async () => {}}
                finish={finish}
                mediaId=""
                onSaving={() => setBusy(true)}
                onReady={() => setBusy(false)}
                defaultFilename={defaultFilename}
                allowRecord={hasRights}
                recordBlocked={!active}
                setCanSave={setCanSave}
                setHasTake={setHasTake}
                setStatusText={setStatusText}
                width={dialogWidth}
                height={160}
                allowZoom={true}
                allowNoNoise={true}
                allowDeltaVoice={true}
                onRecording={(isRecording) => {
                  setIsRecording(isRecording);
                  if (isRecording) onStartRecording?.();
                }}
                pendingRestore={pendingRestore}
                uploadType={uploadType}
                beforeUpload={beforeUpload}
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
                (ready && !ready()) ||
                !(onNext ? hasTake : canSave) ||
                !hasRights
              }
              onClick={onNext ?? (() => startSave(myToolId))}
            >
              {primaryButtonText || recordStrings.save}
            </Button>
          </DialogActions>
        </>
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          onVisible={() => {}}
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

export default PassageRecordPanel;
