import { useState } from 'react';
import { Box, Dialog, DialogTitle, IconButton, styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageDetailArtifactsStrings } from '../model';
import { resourceSelector } from '../selector';
import { UploadType } from './UploadType';
import PassageRecordPanel from './PassageRecordPanel';
import Confirm from './AlertDialog';

const audioDlgWidth = 'min(680px, calc(100vw - 32px))';
const audioDlgHeight = 'min(700px, calc(100dvh - 32px))';

const RecordDialog = styled(Dialog)(({ theme }) => ({
  flexGrow: 1,
  '& .MuiDialog-paper': {
    width: audioDlgWidth,
    maxWidth: audioDlgWidth,
    minWidth: 0,
    height: audioDlgHeight,
    minHeight: audioDlgHeight,
    maxHeight: audioDlgHeight,
  },
  // Tighten vertical chrome so record mode (speaker + player + metadata)
  // fits without scrolling on typical laptop heights.
  '& .MuiDialogTitle-root': {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(0.5),
  },
  '& .MuiDialogContent-root': {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  '& .MuiDialogActions-root': {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
  },
  '& #uploadCancel, & #uploadSave': {
    margin: theme.spacing(1),
  },
}));

interface IProps {
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
}

/**
 * Dialog frame around PassageRecordPanel: the Add Audio Resource modal used by
 * the Uploader. The tab/record/upload logic lives in the panel so it can also be
 * embedded directly in the add-resource wizard (see PassageRecordPanel).
 */
function PassageRecordDlg(props: IProps) {
  const resourceStrings: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  // Sticky for the dialog's open life: set once a recording starts, it gates the
  // close confirm. The Uploader mounts this dialog only while open, so every open
  // is a fresh instance and this starts false on its own — no re-arm needed.
  const [startedRecording, setStartedRecording] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const requestClose = (
    _event?: object,
    reason?: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // outside click should not close the dialog
    if (reason === 'backdropClick') return;
    if (startedRecording) {
      setShowConfirm(true);
      return;
    }
    props.onCancel();
  };

  return (
    // Mounted only while open (see Uploader), so `open` is always true here;
    // closing unmounts the dialog, which tears down the recorder and mic.
    <RecordDialog
      open
      onClose={requestClose}
      aria-labelledby="addAudioDlg"
      disableEnforceFocus
    >
      <DialogTitle
        id="addAudioDlg"
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {resourceStrings.addAudioResource}
        </Box>
        <IconButton
          id="addAudioClose"
          onClick={() => requestClose()}
          sx={{ alignSelf: 'flex-start' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <PassageRecordPanel
        {...props}
        active
        onStartRecording={() => setStartedRecording(true)}
      />
      {showConfirm && (
        <Confirm
          title={resourceStrings.confirmCloseTitle}
          text={resourceStrings.confirmClose}
          no={resourceStrings.keepOpen}
          primaryButton="no"
          yes={resourceStrings.discardAndClose}
          noResponse={() => setShowConfirm(false)}
          yesResponse={() => {
            setShowConfirm(false);
            props.onCancel();
          }}
        />
      )}
    </RecordDialog>
  );
}

export default PassageRecordDlg;
