import React, { useMemo } from 'react';
import MediaUploadDialog from './MediaUploadDialog';
import PassageRecordDlg from './PassageRecordDlg';
import { useMediaUpload, VernacularTag, findRecord, related } from '../crud';
import { useGlobal } from '../context/useGlobal';
import { infoMsg, logError, restoreScroll, Severity } from '../utils';
import { toError } from '../utils/toError';
import { splitFaithbridgeValue } from '../utils/contentType';
import { AlertSeverity } from '../hoc/SnackBar';
import { UploadType } from './UploadType';
import { Box } from '@mui/material';
import { BigDialogBp } from '../hoc/BigDialogBp';

// The record/upload dialog names recordings from defaultFilename, so a host
// that turns on audioUploadOrRecord must supply one.
type RecordModeProps =
  | { audioUploadOrRecord: true; defaultFilename: string }
  | {
      audioUploadOrRecord?: false | undefined;
      defaultFilename?: string | undefined;
    };

interface IBaseProps {
  noBusy?: boolean | undefined;
  /** When true, do not wait for `importexportBusy` before staging upload (record save may hold it). */
  skipImportExportWait?: boolean | undefined;
  mediaId?: string | undefined;
  isOpen: boolean;
  onOpen: (visible: boolean) => void;
  showMessage?:
    | ((msg: string | React.JSX.Element, alert?: AlertSeverity) => void)
    | undefined;
  finish?: ((mediaRemoteIds?: string[]) => Promise<void>) | undefined; // logic when upload complete
  metaData?: React.JSX.Element | undefined; // component embeded in dialog
  // Awaited once when the upload starts, before any media is created. Lets the
  // embedded metaData commit deferred edits (e.g. create a new artifact
  // category) so `finish` sees the resolved ids.
  beforeUpload?: (() => Promise<void>) | undefined;
  ready?: (() => boolean) | undefined; // if false control is disabled
  cancelled: React.RefObject<boolean>;
  cancelReset?: (() => void) | undefined; // reset the cancelled state
  multiple?: boolean | undefined;
  importList?: File[] | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  artifactState?: { id?: string | null } | undefined;
  passageId?: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  eafUrl?: string | undefined;
  onSpeakerChange?: ((performedBy: string) => void) | undefined;
  topic?: string | undefined;
  uploadType?: UploadType | undefined;
  inValue?: string | undefined; // used when adding Aquifer markdown
  team?: string | undefined; // used when adding a card to check speakers
  onNonAudio?: ((nonAudio: boolean) => void) | undefined;
  audioOnly?: boolean | undefined;
  uploadDialogBp?: BigDialogBp;
  validationMessage?: string | undefined;
  /** Hide the upload dialog's bottom "Cancel" button (cancel via the dialog X). */
  hideUploadCancel?: boolean | undefined;
  /** Domain restore metadata for pending-upload Retry (TT-7363). */
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
  /**
   * When set, the Add Audio Resource dialog's Next stages the prepared file(s)
   * via `onStageFiles` instead of uploading them. The general-resource flow
   * uses this to defer the upload until the user picks passages/sections; the
   * actual upload is then driven through `importList`.
   */
  deferUpload?: boolean | undefined;
  /** `recorded` is true when the staged file is a take from the record tab. */
  onStageFiles?:
    ((files: File[], recorded?: boolean) => void | Promise<void>) | undefined;
  /** Pre-select these files when the dialog opens (see MediaUploadContent) —
   *  used to restore a staged file after the Add Resource wizard's Back. */
  initialFiles?: File[] | undefined;
}

type IProps = IBaseProps & RecordModeProps;

/**
 * The upload dialog (or, with `audioUploadOrRecord`, the record/upload dialog)
 * driven by the shared useMediaUpload pipeline.
 */
export const Uploader = (props: IProps) => {
  const {
    noBusy,
    skipImportExportWait,
    mediaId,
    audioUploadOrRecord,
    defaultFilename,
    isOpen,
    onOpen,
    showMessage,
    cancelled,
    cancelReset,
    multiple,
    importList,
    onFiles,
    artifactState,
    passageId,
    planId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    eafUrl,
    onSpeakerChange,
    topic,
    uploadType,
    inValue,
    team,
    onNonAudio,
    audioOnly,
    finish,
    uploadDialogBp,
    validationMessage,
    hideUploadCancel,
    pendingRestore,
    deferUpload,
    onStageFiles,
    initialFiles,
  } = props;
  const { metaData, ready, beforeUpload } = props;
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const [errorReporter] = useGlobal('errorReporter');

  const resolvedLocalPlanId = useMemo(() => {
    if (passageId) {
      const psg = findRecord(memory, 'passage', passageId);
      const section =
        psg && findRecord(memory, 'section', related(psg, 'section'));
      return (section && (related(section, 'plan') as string)) || undefined;
    }
    return planId || plan;
  }, [passageId, planId, plan, memory]);

  const handleSpeakerChange = (speaker: string) => {
    onSpeakerChange && onSpeakerChange(speaker);
  };

  // A Faithbridge/Aquifer link arrives as one `url||transcript` value: the URL
  // is the file content, the transcript a mediafile field.
  const faithbridge =
    uploadType === UploadType.FaithbridgeLink && inValue
      ? splitFaithbridgeValue(inValue)
      : undefined;
  const effectiveInValue = faithbridge ? faithbridge.url : inValue;

  // Close the dialog once the batch is done (even if `finish` throws), as the
  // pre-hook Uploader did; the dialog itself only clears its progress on failure.
  const finishAndClose = async (mediaRemoteIds?: string[]) => {
    try {
      await finish?.(mediaRemoteIds);
    } finally {
      onOpen(false);
    }
  };

  // The whole upload pipeline (record build, per-file send, progress, finish,
  // unsupported/toobig messages, and the importList trigger) lives in the hook.
  const uploadMedia = useMediaUpload({
    fields: {
      artifactId: artifactState?.id ?? VernacularTag,
      passageId,
      localPlanId: resolvedLocalPlanId,
      sourceMediaId,
      sourceSegments,
      performedBy,
      topic,
      eafUrl,
      transcription: faithbridge?.transcription,
    },
    uploadType,
    pendingRestore,
    finish: finishAndClose,
    cancelled,
    noBusy,
    skipImportExportWait,
    beforeUpload,
    // Passage files always version
    // TODO cleanup: I don't love that versionFilenames (adding the passage suffix)
    // defaults to false in useMediaUpload and true here. I'm worried this makes
    // it more confusing for future consumers to set correctly.
    versionFilenames: true,
    importList,
  });

  // The record tab uploads through MediaRecord's own pipeline, which already
  // reports progress and completion; only the host's `finish` is left to run.
  const recordAfterUploadCb = async (mediaId: string | undefined) => {
    if (cancelled) cancelled.current = !mediaId;
    if (!finish) return;
    try {
      await finish(mediaId ? [mediaId] : []);
    } catch (err) {
      logError(
        Severity.error,
        errorReporter,
        infoMsg(toError(err), 'upload finish failed')
      );
    }
  };

  // Deferred general-resource flow: hand the prepared file(s) to the parent
  // rather than uploading now. `onStageFiles` is async (it awaits category
  // creation), so await it and report a failure instead of swallowing it.
  const stageFiles = async (files: File[]) => {
    try {
      await onStageFiles?.(files);
      return true;
    } catch (err) {
      const error = toError(err);
      // Surface the failure (e.g. category creation) rather than silently
      // re-enabling the dialog with no feedback, and log it for diagnosis.
      showMessage?.(error.message, AlertSeverity.Error);
      logError(
        Severity.error,
        errorReporter,
        infoMsg(error, 'resource staging failed')
      );
      return false;
    }
  };
  const deferring = Boolean(deferUpload && onStageFiles);
  const effectiveUploadMethod = deferring ? stageFiles : uploadMedia;

  const uploadCancel = () => {
    onOpen(false);
    if (cancelled) cancelled.current = true;
    cancelReset?.();
    restoreScroll();
  };

  const hasImport = Boolean(importList && importList.length > 0);

  return (
    <Box sx={{ width: '100%' }}>
      {audioUploadOrRecord && !hasImport && (
        <PassageRecordDlg
          artifactId={artifactState?.id ?? VernacularTag}
          passageId={passageId}
          planId={resolvedLocalPlanId}
          visible={isOpen}
          onVisible={onOpen}
          mediaId={mediaId ?? ''}
          afterUploadCb={recordAfterUploadCb}
          onCancel={uploadCancel}
          metaData={metaData}
          ready={ready}
          defaultFilename={defaultFilename}
          allowWave={false}
          speaker={performedBy}
          onSpeaker={handleSpeakerChange}
          team={team}
          uploadType={uploadType || UploadType.Media}
          uploadMethod={effectiveUploadMethod}
          // Only the record tab calls onStageFile (the upload tab stages via
          // uploadMethod), so anything staged here is a recorded take.
          onStageFile={
            deferring
              ? (files) => onStageFiles?.(files, /* recorded */ true)
              : undefined
          }
          multiple={multiple}
          onFiles={onFiles}
          initialFiles={initialFiles}
          keepFilesAfterSubmit={deferring}
          inValue={effectiveInValue}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
          pendingRestore={pendingRestore}
          beforeUpload={beforeUpload}
        />
      )}
      {!audioUploadOrRecord && !hasImport && (
        <MediaUploadDialog
          visible={isOpen}
          onVisible={onOpen}
          bp={uploadDialogBp}
          uploadType={uploadType || UploadType.Media}
          multiple={multiple}
          uploadMethod={uploadMedia}
          cancelMethod={uploadCancel}
          hideCancel={hideUploadCancel}
          metaData={metaData}
          ready={ready}
          speaker={performedBy}
          onSpeaker={
            !artifactState?.id &&
            (uploadType || UploadType.Media) === UploadType.Media
              ? handleSpeakerChange
              : undefined
          }
          inValue={effectiveInValue}
          team={team}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          onFiles={onFiles}
          initialFiles={initialFiles}
          keepFilesAfterSubmit={deferring}
          validationMessage={validationMessage}
        />
      )}
    </Box>
  );
};

export default Uploader;
