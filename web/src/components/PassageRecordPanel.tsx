import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  DialogActions,
  DialogContent,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
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

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
}));

export interface IPassageRecordPanelProps {
  /** The step is active (was `visible`): drives the mode-reset effects. */
  active: boolean;
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
  onStageFile?: ((files: File[]) => void | Promise<void>) | undefined;
  keepFilesAfterSubmit?: boolean | undefined;
  onStartRecording?: (() => void) | undefined;
}

/**
 * The body of the Add Audio Resource dialog: the Upload/Record tab toggle and
 * the record or upload content. Extracted from PassageRecordDlg so it can either
 * be wrapped in that dialog (the standard Uploader path) or embedded directly in
 * the add-resource wizard's single dialog as a show/hide step.
 */
export function PassageRecordPanel(props: IPassageRecordPanelProps) {
  const {
    active,
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
    onStageFile,
    keepFilesAfterSubmit,
    onStartRecording,
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
  // Kept to disable the Upload tab toggle and block the tab switch while a
  // recording is in progress — not reported out: the host's close confirm is
  // driven by the sticky onStartRecording latch, not live recording state.
  const [isRecording, setIsRecording] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecordDlg';
  useEffect(() => {
    if (active) setIsRecording(false);
  }, [active]);

  useEffect(() => {
    if (mode === 'record') {
      setBusy(false);
      setStatusText('');
      setCanSave(false);
      setCanCancel(false);
      // Trust a preselected speaker, as the upload tab does: "Do later" in
      // ProvideRights grants rights without creating an IP record, so
      // SpeakerName can't re-derive them from the rights list on reopen.
      setHasRights(Boolean(speaker?.trim()));
      setIsRecording(false);
    }
    // Only on tab entry: re-running on speaker change would override
    // SpeakerName reporting no rights for a newly chosen, unlisted name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'record' && mediaId !== mediaState.id) {
      fetchMediaUrl({ id: mediaId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mediaId]);

  useEffect(() => setBusy(false), [active]);

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(contentRef));
  }, []);

  useEffect(() => {
    if (mode !== 'record') return;
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
  }, [mode, active, updateDialogWidth]);

  const handleMode = (nextMode: AudioAddMode) => {
    if (isRecording && nextMode === 'upload') return;
    if (nextMode === 'record') {
      // Switching to record abandons any file selection made on the upload tab.
      // Clear it so a stale multi-file general-resource selection can't keep
      // blocking save once the user records instead.
      onFiles?.([]);
    }
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
    <>
      <UploadRecordToggle
        mode={mode}
        onMode={handleMode}
        disableUpload={isRecording}
      />
      {mode === 'record' ? (
        <>
          <DialogContent id="recDlgContent" ref={contentRef}>
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
                // Only the on-screen step owns the keyboard shortcuts; a hidden
                // record panel (wizard on step 2/3) must not react to Alt+Space/F9.
                hotkeys={active}
                artifactId={artifactId}
                passageId={passageId}
                planId={planId}
                afterUploadCb={afterUploadCb}
                mediaId={mediaId}
                onSaving={() => setBusy(true)}
                onReady={() => setBusy(false)}
                defaultFilename={defaultFilename}
                allowRecord={hasRights && active}
                allowWave={allowWave}
                setCanSave={setCanSave}
                setCanCancel={setCanCancel}
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
          keepFilesAfterSubmit={keepFilesAfterSubmit}
          inValue={inValue}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
        />
      )}
    </>
  );
}

export default PassageRecordPanel;
