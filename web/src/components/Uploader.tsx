import React, { useMemo } from 'react';
import MediaUploadDialog from './MediaUploadDialog';
import { useMediaUpload, VernacularTag, findRecord, related } from '../crud';
import { useGlobal } from '../context/useGlobal';
import { restoreScroll } from '../utils';
import { UploadType } from './UploadType';
import { Box } from '@mui/material';

interface IProps {
  noBusy?: boolean | undefined;
  /** When true, do not wait for `importexportBusy` before staging upload (record save may hold it). */
  skipImportExportWait?: boolean | undefined;
  isOpen: boolean;
  onOpen: (visible: boolean) => void;
  finish?: ((mediaRemoteIds?: string[]) => Promise<void>) | undefined; // logic when upload complete
  cancelled: React.RefObject<boolean>;
  multiple?: boolean | undefined;
  importList?: File[] | undefined;
  artifactState?: { id?: string | null } | undefined;
  passageId?: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  onSpeakerChange?: ((performedBy: string) => void) | undefined;
  topic?: string | undefined;
  uploadType?: UploadType | undefined;
  audioOnly?: boolean | undefined;
  /** Domain restore metadata for pending-upload Retry (TT-7363). */
  pendingRestore?: import('../store/upload/pendingMediaUploads').PendingRestoreInput;
}

/**
 * The standalone upload dialog: a MediaUploadDialog driven by the shared useMediaUpload
 * pipeline.
 */
export const Uploader = (props: IProps) => {
  const {
    noBusy,
    skipImportExportWait,
    isOpen,
    onOpen,
    cancelled,
    multiple,
    importList,
    artifactState,
    passageId,
    planId,
    sourceMediaId,
    sourceSegments,
    performedBy,
    onSpeakerChange,
    topic,
    uploadType,
    audioOnly,
    finish,
    pendingRestore,
  } = props;
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
    },
    uploadType,
    pendingRestore,
    finish: finishAndClose,
    cancelled,
    noBusy,
    skipImportExportWait,
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
    restoreScroll();
  };

  const hasImport = Boolean(importList && importList.length > 0);

  return (
    <Box sx={{ width: '100%' }}>
      {!hasImport && (
        <MediaUploadDialog
          visible={isOpen}
          onVisible={onOpen}
          uploadType={uploadType || UploadType.Media}
          multiple={multiple}
          uploadMethod={uploadMedia}
          cancelMethod={uploadCancel}
          speaker={performedBy}
          onSpeaker={
            !artifactState?.id &&
            (uploadType || UploadType.Media) === UploadType.Media
              ? handleSpeakerChange
              : undefined
          }
          audioOnly={audioOnly}
        />
      )}
    </Box>
  );
};

export default Uploader;
