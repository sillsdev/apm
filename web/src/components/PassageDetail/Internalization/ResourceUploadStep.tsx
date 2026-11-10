import { RefObject } from 'react';
import { Box } from '@mui/material';
import MediaUploadContent from '../../MediaUploadContent';
import PassageRecordPanel, { IDeferredUpload } from '../../PassageRecordPanel';
import { useMediaUpload, VernacularTag } from '../../../crud';
import { splitFaithbridgeValue } from '../../../utils/contentType';
import { UploadType } from '../../UploadType';
import type { PendingRestoreInput } from '../../../store/upload/pendingMediaUploads';

interface IProps {
  active: boolean;
  isAudioMode: boolean; //shows a Record option as well as upload
  uploadType: UploadType;
  artifactId?: string | null | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  eafUrl?: string | undefined;
  inValue?: string | undefined;
  defaultFilename: string;
  ready?: (() => boolean) | undefined;
  validationMessage?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  beforeUpload?: (() => Promise<void>) | undefined;
  cancelled: RefObject<boolean>;
  pendingRestore?: PendingRestoreInput | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  deferred?: IDeferredUpload | undefined; // for the general-resource flow which defers uploading the media until the next step
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
    artifactId: artifactIdProp,
    speaker,
    onSpeaker,
    eafUrl,
    inValue,
    defaultFilename,
    ready,
    validationMessage,
    metaData,
    finish,
    beforeUpload,
    cancelled,
    pendingRestore,
    onFiles,
    deferred,
    onStartRecording,
  } = props;
  const artifactId = artifactIdProp ?? VernacularTag;

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
      {isAudioMode ? (
        <PassageRecordPanel
          active={active}
          onStartRecording={onStartRecording}
          artifactId={artifactId}
          finish={recordFinish}
          metaData={metaData}
          ready={ready}
          defaultFilename={defaultFilename}
          speaker={speaker}
          onSpeaker={onSpeaker}
          uploadType={uploadType}
          uploadMethod={uploadMedia}
          deferred={deferred}
          onFiles={onFiles}
          validationMessage={validationMessage}
          pendingRestore={pendingRestore}
          beforeUpload={beforeUpload}
        />
      ) : (
        <MediaUploadContent
          noWrapper
          hideCancel
          onVisible={() => {}}
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
