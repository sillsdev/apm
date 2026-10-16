import { RefObject } from 'react';
import { Box } from '@mui/material';
import MediaUploadContent, {
  MediaUploadControlsRef,
} from '../../MediaUploadContent';
import PassageRecordPanel from '../../PassageRecordPanel';
import { useMediaUpload, VernacularTag } from '../../../crud';
import { restoreScroll } from '../../../utils';
import { splitFaithbridgeValue } from '../../../utils/contentType';
import { UploadType } from '../../UploadType';
import type { PendingRestoreInput } from '../../../store/upload/pendingMediaUploads';

interface IProps {
  /** The step is on-screen (drives record-panel mode resets + hotkeys). */
  active: boolean;
  /** Show the Upload/Record toggle (audio) vs a plain upload body (link/pdf/text). */
  isAudioMode: boolean;
  uploadType: UploadType;
  artifactState?: { id?: string | null } | undefined;
  performedBy?: string | undefined;
  onSpeakerChange?: ((performedBy: string) => void) | undefined;
  eafUrl?: string | undefined;
  inValue?: string | undefined;
  defaultFilename?: string | undefined;
  multiple?: boolean | undefined;
  ready?: (() => boolean) | undefined;
  validationMessage?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  beforeUpload?: (() => Promise<void>) | undefined;
  cancelled: RefObject<boolean>;
  cancelReset?: (() => void) | undefined;
  pendingRestore?: PendingRestoreInput | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  /** The deferred general-resource flow: the body stays mounted, so Next only
   *  advances (via `onNext`) and the upload fires later off the retained
   *  selection, triggered through `submitRef`. */
  deferred?: boolean | undefined;
  /** Advance to the next wizard step without uploading (deferred flow). */
  onNext?: (() => void) | undefined;
  /** Imperative handle to the active body's real submit, so the wizard can
   *  upload the still-mounted selection once passages/sections are chosen. */
  submitRef?: React.RefObject<MediaUploadControlsRef> | undefined;
  /** Latched by the host once a recording starts (close-confirm, #719). */
  onStartRecording?: (() => void) | undefined;
}

/**
 * The add-resource wizard's step-1 body: the Upload/Record UI, embedded (no
 * dialog of its own) so the wizard shows/hides it as a step and it stays mounted
 * across the flow — a recorded take survives Next→Back. Drives the shared
 * useMediaUpload pipeline directly (the standalone dialog path is Uploader).
 */
export function ResourceUploadStep(props: IProps) {
  const {
    active,
    isAudioMode,
    uploadType,
    artifactState,
    performedBy,
    onSpeakerChange,
    eafUrl,
    inValue,
    defaultFilename,
    multiple,
    ready,
    validationMessage,
    metaData,
    finish,
    beforeUpload,
    cancelled,
    cancelReset,
    pendingRestore,
    onFiles,
    deferred,
    onNext,
    submitRef,
    onStartRecording,
  } = props;

  const handleSpeakerChange = (speaker: string) => {
    onSpeakerChange && onSpeakerChange(speaker);
  };

  // A Faithbridge link arrives as `url||transcript` in inValue; split it here
  // (the resource-aware layer) so the generic upload hook stays link-agnostic —
  // the URL is the file content, the transcript a mediafile field.
  const faithbridge =
    uploadType === UploadType.FaithbridgeLink && inValue
      ? splitFaithbridgeValue(inValue)
      : undefined;
  const effectiveInValue = faithbridge ? faithbridge.url : inValue;

  const uploadMedia = useMediaUpload({
    fields: {
      artifactId: artifactState?.id ?? VernacularTag,
      performedBy,
      eafUrl,
      transcription: faithbridge?.transcription,
    },
    uploadType,
    pendingRestore,
    finish,
    cancelled,
    beforeUpload,
    versionFilenames: true,
  });

  // Deferred general-resource flow: the body stays mounted (CSS-hidden) across
  // the wizard steps, so Next does not stage or lift the file out — it just
  // advances (onNext). The real upload runs later, when SelectSections invokes
  // `submitRef.current.handleAddOrSave`, which submits the selection the body
  // still holds. So the upload method is always the real one.

  // Record tab, per-item bookkeeping only. The take's post-upload linking runs
  // through the panel's own useMediaUpload `finish` (recordFinish, passed to
  // PassageRecordPanel), which fires AFTER the mediafile is pulled into Orbit —
  // so the wizard's afterUpload sees keyMap-resolvable ids, exactly like the
  // file-upload tab. Doing it here instead (pre-pull) PATCHed /api/mediafiles
  // with no id (405) and failed the sectionresource add.
  const recordBookkeeping = async (mediaId: string | undefined) => {
    cancelled.current = !mediaId;
  };

  // The recorded take uploaded; a failure while linking it must not mark the
  // recording itself as failed (it would route through MediaRecord's
  // handleSaveFailed). Mirrors the previous swallow when this ran inside
  // afterUploadCb (TT-7583 / TT-7363 non-fatal follow-up semantics).
  const recordFinish = async (mediaRemoteIds?: string[]) => {
    try {
      if (finish) await finish(mediaRemoteIds);
    } catch {
      // linking failed; the upload itself is finished.
    }
  };

  const uploadCancel = () => {
    if (cancelled) cancelled.current = true;
    cancelReset?.();
    restoreScroll();
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {isAudioMode ? (
        <PassageRecordPanel
          active={active}
          onStartRecording={onStartRecording}
          artifactId={artifactState?.id ?? VernacularTag}
          // Resources are not passage-scoped at the mediafile level; the wizard
          // links passages/sections after upload (afterUpload).
          passageId={undefined}
          onVisible={() => {}}
          mediaId={''}
          afterUploadCb={recordBookkeeping}
          finish={recordFinish}
          onCancel={uploadCancel}
          metaData={metaData}
          ready={ready}
          defaultFilename={defaultFilename ?? 'resource'}
          allowWave={false}
          speaker={performedBy}
          onSpeaker={handleSpeakerChange}
          uploadType={uploadType || UploadType.Media}
          uploadMethod={uploadMedia}
          onNext={deferred ? onNext : undefined}
          controlsRef={deferred ? submitRef : undefined}
          multiple={multiple}
          onFiles={onFiles}
          keepFilesAfterSubmit={deferred}
          inValue={effectiveInValue}
          validationMessage={validationMessage}
          pendingRestore={pendingRestore}
          beforeUpload={beforeUpload}
        />
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          onVisible={() => {}}
          uploadType={uploadType || UploadType.Media}
          multiple={multiple}
          uploadMethod={uploadMedia}
          cancelMethod={uploadCancel}
          metaData={metaData}
          ready={ready}
          speaker={performedBy}
          onFiles={onFiles}
          keepFilesAfterSubmit={deferred}
          inValue={effectiveInValue}
          validationMessage={validationMessage}
        />
      )}
    </Box>
  );
}

export default ResourceUploadStep;
