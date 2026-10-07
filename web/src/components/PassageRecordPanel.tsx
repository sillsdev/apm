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
import Confirm from './AlertDialog';

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
  initialFiles?: File[] | undefined;
  keepFilesAfterSubmit?: boolean | undefined;
  /**
   * Embedded in a host dialog (the add-resource wizard) rather than wrapped by
   * PassageRecordDlg's own dialog. The host owns the dialog chrome, close, and
   * confirm, so the panel renders no Confirm of its own and reports recording
   * state up (onRecordingChange) so the host can gate its close.
   */
  embedded?: boolean | undefined;
  /**
   * Dialog-frame close plumbing (non-embedded). The frame flips
   * `closeRequested` true when its X/escape is used; the panel runs the close
   * logic (block mid-recording, confirm, then close) and calls onCloseHandled
   * to reset the flag.
   */
  closeRequested?: boolean | undefined;
  onCloseHandled?: (() => void) | undefined;
  /** Reported so an embedding host can block its own close mid-recording. */
  onRecordingChange?: ((recording: boolean) => void) | undefined;
  /**
   * Reported so an embedding host can decide whether closing needs a discard
   * confirm: true once a take has been recorded on the record tab (and not yet
   * saved/staged), tracked separately from canSave, which stays false while a
   * take is still processing or is too big to save (#719).
   */
  onHasTakeChange?: ((hasTake: boolean) => void) | undefined;
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
    initialFiles,
    keepFilesAfterSubmit,
    embedded,
    closeRequested,
    onCloseHandled,
    onRecordingChange,
    onHasTakeChange,
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
  // A take has been recorded since the record tab opened. Tracked separately
  // from canSave, which stays false while a take is still processing (or is
  // too big to save), so closing then must still confirm (#719).
  const [hasTake, setHasTake] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecordDlg';
  // Latest initialFiles without making the open/close effects depend on it (so
  // they fire only on visibility changes, never mid-recording).
  const initialFilesRef = useRef(initialFiles);
  initialFilesRef.current = initialFiles;

  useEffect(() => {
    if (active) {
      // Reopening with a staged take (the wizard's Next→Back) keeps the current
      // tab — and, because the dialog is kept mounted, the recorded take and its
      // waveform are still there. A fresh open (no staged files) starts on the
      // Upload tab as before.
      const hasStagedTake = Boolean(initialFilesRef.current?.length);
      if (!hasStagedTake) setMode('upload');
      setRecording(false);
      // A retained take is still in the player on Back (keepMounted), so keep
      // hasTake true — otherwise the wizard's close-confirm thinks nothing would
      // be lost and discards the recording silently.
      setHasTake(hasStagedTake);
      setShowConfirm(false);
    }
  }, [active]);

  // Staying mounted keeps the record tab (and its live recorder) alive while
  // inactive. That is wanted during a Next→Back pause (a take is staged), but on
  // a genuine close drop back to Upload so MediaRecord unmounts and releases the
  // recorder/mic.
  useEffect(() => {
    if (!active && !initialFilesRef.current?.length) {
      setMode('upload');
    }
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
      setRecording(false);
      setHasTake(false);
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

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => {
    onHasTakeChange?.(hasTake);
  }, [hasTake, onHasTakeChange]);

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(contentRef));
  }, []);

  useEffect(() => {
    if (mode !== 'record') return;
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
  }, [mode, active, updateDialogWidth]);

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

  // Non-embedded: the dialog frame asks to close via closeRequested. Embedded
  // hosts own their own close/confirm (and read onRecordingChange to block
  // mid-recording), so this plumbing is inert there.
  useEffect(() => {
    if (!closeRequested) return;
    onCloseHandled?.();
    // Can't close mid-recording (matches handleCancel's own guard).
    if (recording) return;
    // Confirm only when a take on the record tab would be lost; a file upload
    // is cheap to redo, so it never prompts (#719).
    if (mode === 'record' && hasTake) {
      setShowConfirm(true);
      return;
    }
    doClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRequested]);

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
    <>
      <UploadRecordToggle
        mode={mode}
        onMode={handleMode}
        disableUpload={recording}
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
                onRecording={(isRecording) => {
                  setRecording(isRecording);
                  if (isRecording) setHasTake(true);
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
          initialFiles={initialFiles}
          keepFilesAfterSubmit={keepFilesAfterSubmit}
          inValue={inValue}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
        />
      )}
      {!embedded && showConfirm && (
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
    </>
  );
}

export default PassageRecordPanel;
