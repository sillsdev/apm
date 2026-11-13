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
import MediaRecord from '../../MediaRecord';
import { UnsavedContext } from '../../../context/UnsavedContext';
import SpeakerName from '../../SpeakerName';
import { Button } from '../../../control';
import Busy from '../../Busy';
import { useResourceUploadContext } from './ResourceUploadContext';

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
    active,
    artifactId,
    defaultFilename,
    ready,
    metaData,
    speaker,
    onSpeaker,
    onFiles,
    uploadType,
    validationMessage,
    pendingRestore,
    beforeUpload,
    deferred,
    onStartRecording,
  } = useResourceUploadContext();
  const onNext = deferred?.onNext;
  const controlsRef = deferred?.controlsRef;
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
  // The take shown in the recorder has already uploaded. A successful upload
  // clears canSave but leaves the take in the waveform; the deferred wizard's
  // Next must still carry it forward when the user steps back here. Cleared
  // when a new recording starts or the recorder remounts (tab switch).
  const [hadTake, setHadTake] = useState(false);
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
      setHadTake(false);
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
                afterUploadCb={async (uploadedId) => {
                  if (uploadedId) setHadTake(true);
                }}
                finish={finish}
                mediaId=""
                onSaving={() => setBusy(true)}
                onReady={() => setBusy(false)}
                defaultFilename={defaultFilename}
                allowRecord={hasRights}
                recordBlocked={!active}
                setCanSave={setCanSave}
                setStatusText={setStatusText}
                width={dialogWidth}
                height={160}
                allowZoom={true}
                allowNoNoise={true}
                allowDeltaVoice={true}
                onRecording={(isRecording) => {
                  setIsRecording(isRecording);
                  if (isRecording) {
                    setHadTake(false);
                    onStartRecording?.();
                  }
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
              // In the deferred wizard flow this button advances (onNext) rather
              // than saving, so it also allows a take that already uploaded:
              // that clears canSave, but the take must still be carryable
              // forward when the user steps back here.
              disabled={
                busy ||
                ready === false ||
                !(canSave || (onNext && hadTake)) ||
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

export default ResourceRecordPanel;
