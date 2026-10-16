import React, { useMemo } from 'react';
import MediaUploadDialog from './MediaUploadDialog';
import { useMediaUpload, VernacularTag, findRecord, related } from '../crud';
import { useGlobal } from '../context/useGlobal';
import { restoreScroll } from '../utils';
import { AlertSeverity } from '../hoc/SnackBar';
import { UploadType } from './UploadType';
import { Box } from '@mui/material';
import { BigDialogBp } from '../hoc/BigDialogBp';

interface IProps {
  noBusy?: boolean | undefined;
  defaultFilename?: string | undefined;
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
  mediaId?: string | undefined;
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
  audioOnly?: boolean | undefined;
  uploadDialogBp?: BigDialogBp;
  validationMessage?: string | undefined;
  /** Hide the upload dialog's bottom "Cancel" button (cancel via the dialog X). */
  hideUploadCancel?: boolean | undefined;
  /** Domain restore metadata for pending-upload Retry (TT-7363). */
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
}

/**
 * The standalone upload dialog: a MediaUploadDialog driven by the shared useMediaUpload
 * pipeline. The combined record/upload UI (the add-resource wizard's step) lives
 * in ResourceUploadStep, which uses the same hook directly.
 */
export const Uploader = (props: IProps) => {
  const {
    isOpen,
    onOpen,
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
    audioOnly,
    finish,
    uploadDialogBp,
    validationMessage,
    hideUploadCancel,
    pendingRestore,
    noBusy,
  } = props;
  const { metaData, ready, beforeUpload } = props;
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');

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
    },
    uploadType,
    pendingRestore,
    finish,
    cancelled,
    noBusy,
    beforeUpload,
    // Passage files always version
    // TODO cleanup: I don't love that versionFilenames (adding the passage suffix)
    // defaults to false in useMediaUpload and true here. I'm worried this makes
    // it more confusing for future consumers to set correctly.
    versionFilenames: true,
    importList,
  });

  const uploadCancel = () => {
    onOpen(false);
    if (cancelled) cancelled.current = true;
    cancelReset?.();
    restoreScroll();
  };

  const hasImport = Boolean(importList && importList.length > 0);

  return (
    <Box sx={{ width: '100%' }}>
      {!hasImport && (
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
          inValue={inValue}
          team={team}
          audioOnly={audioOnly}
          onFiles={onFiles}
          validationMessage={validationMessage}
        />
      )}
    </Box>
  );
};

export default Uploader;
