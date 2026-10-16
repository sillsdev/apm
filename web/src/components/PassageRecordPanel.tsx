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
  /** Batch callback for the record tab's take, fired post-pull (resolvable
   *  ids). Forwarded to MediaRecord's own useMediaUpload; the record tab's
   *  follow-up work that mutates the new mediafile must use this, not
   *  `afterUploadCb`. */
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
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
  audioOnly?: boolean | undefined;
  validationMessage?: string | undefined;
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  beforeUpload?: (() => Promise<void>) | undefined;
  keepFilesAfterSubmit?: boolean | undefined;
  /** Deferred general-resource flow: the primary button advances to the next
   *  wizard step instead of uploading. The real upload is exposed via
   *  `controlsRef` and fired later from SelectSections. */
  onNext?: (() => void) | undefined;
  /** Imperative handle to this panel's active-tab submit (the real upload), so
   *  the wizard can upload the retained selection/take while the panel is hidden
   *  on a later step. The upload tab forwards MediaUploadContent's own handle;
   *  the record tab exposes its Save here. */
  controlsRef?: React.RefObject<MediaUploadControlsRef>;
  // TODO should we be lifting the files up to the wizard to submit from there instead?
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
    finish,
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
    audioOnly,
    validationMessage,
    pendingRestore,
    beforeUpload,
    keepFilesAfterSubmit,
    onNext,
    controlsRef,
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
  const [mode, setMode] = useState<AudioAddMode>(AudioAddMode.Upload);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [hasRights, setHasRights] = useState(false);
  // For blocking switch to Upload tab while
  // recording is in progress
  const [isRecording, setIsRecording] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const myToolId = 'PassageRecord';
  useEffect(() => {
    if (active) setIsRecording(false);
  }, [active]);

  useEffect(() => {
    if (mode === AudioAddMode.Record) {
      setBusy(false);
      setStatusText('');
      setCanSave(false);
      // Trust a preselected speaker, like the upload tab does: "Do later" in
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
    if (mode === AudioAddMode.Record && mediaId !== mediaState.id) {
      fetchMediaUrl({ id: mediaId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mediaId]);

  useEffect(() => setBusy(false), [active]);

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

  const saveButtonText =
    uploadType === UploadType.ProjectResource
      ? resourceStrings.next
      : undefined;

  // Expose the record tab's Save as the imperative submit so the wizard's
  // SelectSections "Upload" can upload the retained take while this panel is
  // hidden (it stays mounted). The upload tab sets this through
  // MediaUploadContent's own controlsRef below; only one tab is mounted at a
  // time, so whichever is active owns the handle.
  useEffect(() => {
    if (controlsRef && mode === AudioAddMode.Record) {
      controlsRef.current.handleAddOrSave = () => startSave(myToolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
                finish={finish}
                mediaId={mediaId}
                onSaving={() => setBusy(true)}
                onReady={() => setBusy(false)}
                defaultFilename={defaultFilename}
                allowRecord={hasRights && active}
                allowWave={allowWave}
                setCanSave={setCanSave}
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
              onClick={onNext ?? (() => startSave(myToolId))}
            >
              {saveButtonText || recordStrings.save}
            </Button>
          </DialogActions>
        </>
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          onVisible={onVisible}
          uploadType={uploadType}
          saveButtonText={saveButtonText}
          onNext={onNext}
          controlsRef={controlsRef}
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
          audioOnly={audioOnly}
          validationMessage={validationMessage}
        />
      )}
    </>
  );
}

export default PassageRecordPanel;
