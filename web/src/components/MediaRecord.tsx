import React from 'react';
import { IPassageRecordStrings } from '../model';
import { Stack, Paper, Typography } from '@mui/material';
import WSAudioPlayer, { WSAudioPlayerControls } from './WSAudioPlayer';
import { useMobile } from '../utils';
import { IMediaState } from '../crud';
import { UploadType } from './UploadType';
import { mb } from '../utils/mb';
import { useSelector } from 'react-redux';
import { passageRecordSelector } from '../selector';
import {
  useMediaRecord,
  type MediaRecordState,
  type MediaRecordStateKey,
} from './useMediaRecord';

// TODO cleanup: controlsRef is only passed by the Cypress specs
export interface IProps {
  toolId: string;
  artifactId: string | null;
  passageId: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  topic?: string | undefined;
  languagebcp47?: string | undefined;
  keepItSmall?: boolean | undefined;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  /**
   * Optional batch callback, forwarded to this recorder's own useMediaUpload.
   * It fires once, AFTER the uploaded take has been pulled into Orbit, so its
   * ids resolve via the keyMap — unlike `afterUploadCb`, which reports per item
   * before that pull. Hosts whose follow-up work mutates the new mediafile (set
   * a topic, create a sectionresource) must use this, not `afterUploadCb`.
   */
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  /**
   * Domain restore metadata for pending-upload Retry (TT-7363).
   */
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  /** What the take is uploaded as (size limit, pending-queue rules). Defaults to Media. */
  uploadType?: UploadType | undefined;
  /**
   * Commit deferred metadata before the recorded upload is staged so
   * `pendingRestore` can include newly created category ids.
   */
  beforeUpload?: () => Promise<void>;
  onReady?: (() => void) | undefined;
  onSaving?: (() => void) | undefined;
  onRecording?: ((r: boolean) => void) | undefined;
  onPlayStatus?: ((p: boolean) => void) | undefined;
  mediaId?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  defaultFilename: string;
  allowDeltaVoice?: boolean | undefined;
  /** When false, hide the Download item in the recorder's more menu. Default true if omitted. */
  allowDownload?: boolean;
  setCanSave: (canSave: boolean) => void;
  // TODO cleanup: combine a bunch of these props that describe what stage the recording is in
  // into one lifecycle prop that sets the current stage as e.g. Recording, Saving, Loading, Unsaved, etc. Maybe even HasValidTake or HasInvalidTake?
  // Also, in particular, make the situation around recording and the recorder more readable.
  // At the very least, allowRecord should be renamed to indicate that it controls the total
  // presence or absence of the recorder, unlike recordBlocked.
  /**
   * Called when a save attempt is rejected — the upload failed or finished
   * without a mediaId. May fire more than once for a single failed save, so
   * handlers must be idempotent. Parents that auto-save on the rising edge of
   * canSave use this to stop retrying the same doomed take (TT-7583); canSave
   * itself stays true so screens with a manual Save button keep their retry
   * path.
   */
  onSaveRejected?: (() => void) | undefined;
  setStatusText: (status: string) => void;
  allowRecord?: boolean | undefined;
  oneTryOnly?: boolean | undefined;
  allowWave?: boolean | undefined;
  height?: number;
  width?: number;
  doReset?: boolean | undefined;
  setDoReset?: ((r: boolean) => void) | undefined;
  preload?: number | undefined;
  autoStart?: boolean | undefined;
  trackState?: ((mediaState: IMediaState) => void) | undefined;
  noNewVoice?: boolean | undefined;
  allowNoNoise?: boolean;
  allowZoom?: boolean;
  /** When true, disable drag-to-create-region (the red loop region) on the waveform. */
  disableDragSelection?: boolean;
  controlsRef?: React.RefObject<WSAudioPlayerControls | null>;
  /** Forwarded to WSAudioPlayer: when false, this recorder claims no keyboard
   *  shortcuts (so an off-screen instance yields them). Default true. */
  hotkeys?: boolean;
  hideToolbar?: boolean;
  isStopLogic?: boolean;
  showSize?: boolean;
  handleUpload?: () => void;
  isRecordingRights?: boolean;
  rightsLeftActions?: React.JSX.Element;
  /** Force mobile layout (used by rights UI to match mobile experience on desktop). */
  forceMobileView?: boolean;
  onVersions?: () => void;
  handleSave?: () => void;
  isSaveDisabled?: boolean;
  dockRecordButton?: boolean;
  onDockedRecordButton?: (node: React.ReactNode | null) => void;
  /** When true, show the docked record button even if allowRecord is false (button may be disabled). */
  showDockedRecordButton?: boolean;
  /** Disable the record button without releasing the microphone. */
  recordBlocked?: boolean;
  onRecordingCleared?: () => void;
  /** Gate starting a new recording; return false (or resolve false) to abort. */
  onBeforeStartRecord?: () => boolean | Promise<boolean>;
}

export type IMediaRecordViewProps = Omit<
  IProps,
  Exclude<MediaRecordStateKey, 'mediaId' | 'planId' | 'doReset'> | 'setCanSave'
> & { rec: MediaRecordState };

/** Renders a recorder whose state comes from useMediaRecord. */
export function MediaRecordView(props: IMediaRecordViewProps) {
  const {
    rec,
    mediaId,
    planId,
    doReset,
    onPlayStatus,
    allowDeltaVoice,
    allowDownload,
    allowRecord,
    autoStart,
    height,
    metaData,
    noNewVoice,
    allowNoNoise,
    allowZoom,
    disableDragSelection,
    controlsRef,
    hotkeys = true,
    hideToolbar,
    width,
    keepItSmall,
    showSize = true,
    handleUpload,
    isRecordingRights,
    rightsLeftActions,
    forceMobileView,
    handleSave,
    onVersions,
    isSaveDisabled,
    dockRecordButton,
    onDockedRecordButton,
    showDockedRecordButton,
    recordBlocked,
    onBeforeStartRecord,
  } = props;
  const {
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
    onBlobReady,
    myOnRecording,
    setFilechanged,
    setProcessingRecording,
    setBlobReady,
    handleWaveformDuration,
    handleWaveformLoadError,
    handleRecordingCleared,
    gotTheBlob,
  } = rec;
  const t: IPassageRecordStrings = useSelector(passageRecordSelector);
  const { isMobile: isMobileView } = useMobile();
  const effectiveMobileView = Boolean(forceMobileView) || isMobileView;
  const segments = '{}';

  const content = (
    <>
      <WSAudioPlayer
        hotkeys={hotkeys}
        allowRecord={allowRecord !== false}
        loading={loading}
        allowZoom={allowZoom}
        disableDragSelection={disableDragSelection}
        allowDeltaVoice={allowDeltaVoice}
        allowDownload={allowDownload}
        oneTryOnly={effectiveOneTryOnly}
        height={height || 300}
        mediaId={mediaId}
        planId={planId}
        blob={originalBlob}
        onBlobReady={onBlobReady}
        onLoadError={handleWaveformLoadError}
        setChanged={setFilechanged}
        onProcessingRecordingChange={setProcessingRecording}
        setBlobReady={setBlobReady}
        onRecording={myOnRecording}
        onPlayStatus={onPlayStatus}
        doReset={doReset}
        autoStart={autoStart}
        onDuration={handleWaveformDuration}
        controlsRef={controlsRef}
        hideToolbar={hideToolbar}
        segments={segments}
        reload={gotTheBlob}
        noNewVoice={noNewVoice}
        allowNoNoise={allowNoNoise}
        captureEchoCancellation={captureAudioProcessing.echoCancellation}
        captureNoiseSuppression={captureAudioProcessing.noiseSuppression}
        keepItSmall={keepItSmall}
        isStopLogic={effectiveIsStopLogic}
        hideWaveformEditTools={simplified}
        isRecordingRights={isRecordingRights}
        handleUpload={handleUpload}
        rightsLeftActions={rightsLeftActions}
        forceMobileView={forceMobileView}
        handleSave={handleSave}
        onVersions={onVersions}
        isSaveDisabled={
          Boolean(isSaveDisabled) ||
          waveformDuration <= 0 ||
          processingRecording ||
          sizeBlocksSave ||
          (wantsSaveVisible && !blobReady)
        }
        mediaSaveInProgress={mediaSaveInProgress}
        showWaveformSave={wantsSaveVisible}
        dockRecordButton={dockRecordButton}
        onDockedRecordButton={onDockedRecordButton}
        showDockedRecordButton={showDockedRecordButton}
        recordBlocked={recordBlocked}
        onRecordingCleared={handleRecordingCleared}
        onBeforeStartRecord={onBeforeStartRecord}
      />
      {showProcessingRecordingMessage ? (
        <Typography sx={{ m: 2, color: 'text.secondary' }} id="warning">
          {t.processing}
        </Typography>
      ) : (
        sizeWarning && (
          <Typography sx={{ m: 2, color: 'warning.dark' }} id="warning">
            {sizeWarning}
          </Typography>
        )
      )}
      {(showSize || metaData) && !effectiveMobileView && (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
        >
          {showSize && (
            <Typography sx={{ mr: 3 }} id="size">
              {mb(estimatedBytes)}
            </Typography>
          )}
          {metaData}
        </Stack>
      )}
    </>
  );

  if (!showSize && !metaData) {
    return content;
  }
  return effectiveMobileView ? (
    content
  ) : (
    <Paper
      id="mediaRecord"
      sx={{
        width: width ?? '100%', // isMobileView is false here
        maxWidth: width ?? '100%',
        minWidth: 0,
      }}
    >
      {content}
    </Paper>
  );
}
function MediaRecord(props: IProps) {
  const rec = useMediaRecord(props);
  return <MediaRecordView {...props} rec={rec} />;
}
export default MediaRecord;
