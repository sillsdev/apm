import { Box } from '@mui/material';
import MediaUploadContent from '../../MediaUploadContent';
import ResourceRecordPanel from './ResourceRecordPanel';
import { useMediaUpload } from '../../../crud';
import { splitFaithbridgeValue } from '../../../utils/contentType';
import { UploadType } from '../../UploadType';
import { useResourceUploadContext } from './ResourceUploadContext';

/**
 * The add-resource wizard's step-1 body: the Upload/Record UI, embedded (no
 * dialog of its own) so the wizard shows/hides it as a step and it stays mounted
 * across the flow — a recorded take survives Next→Back. Drives the shared
 * useMediaUpload pipeline directly (the standalone dialog path is Uploader).
 * Reads its inputs from ResourceUploadContext.
 */
export function ResourceUploadStep() {
  const {
    isAddingAudioResource,
    uploadType,
    artifactId,
    speaker,
    eafUrl,
    inValue,
    ready,
    validationMessage,
    metaData,
    finish,
    beforeUpload,
    cancelled,
    pendingRestore,
    onFiles,
  } = useResourceUploadContext();

  // A Faithbridge link arrives as `url||transcript` in inValue; split it here
  const faithbridge =
    uploadType === UploadType.FaithbridgeLink && inValue
      ? splitFaithbridgeValue(inValue)
      : undefined;
  const effectiveInValue = faithbridge ? faithbridge.url : inValue;

  const uploadMedia = useMediaUpload({
    fields: {
      artifactId,
      performedBy: speaker,
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

  const recordFinish = async (mediaRemoteIds?: string[]) => {
    cancelled.current = !mediaRemoteIds?.length;
    await finish?.(mediaRemoteIds);
  };

  return (
    <Box
      sx={{
        width: '100%',
        // Must grow via flex, not height:100%, because the dialog paper has only a min-height
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        // The bodies' DialogActions sit inside the wizard's DialogContent, which
        // already pads the edges; drop their own padding (and the record save
        // button's margin) so both tabs' footer positions matches the other Wizard steps'
        // ActionRow
        '& > .MuiDialogActions-root': { p: 0, pb: 1 },
        '& > .MuiDialogActions-root > .MuiButton-root': { m: 0 },
      }}
    >
      {isAddingAudioResource ? (
        <ResourceRecordPanel uploadMethod={uploadMedia} finish={recordFinish} />
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          uploadType={uploadType}
          multiple
          uploadMethod={uploadMedia}
          metaData={metaData}
          ready={ready}
          speaker={speaker}
          onFiles={onFiles}
          inValue={effectiveInValue}
          validationMessage={validationMessage}
        />
      )}
    </Box>
  );
}

export default ResourceUploadStep;
