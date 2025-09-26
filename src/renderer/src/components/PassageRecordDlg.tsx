import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useGlobal } from '../context/useGlobal';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageRecordStrings } from '../model';
import { getRefWidth } from '../utils/getRefWidth';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
import { useFetchMediaUrl } from '../crud';
import MediaRecord from './MediaRecord';
import { UnsavedContext } from '../context/UnsavedContext';
import SpeakerName from './SpeakerName';
import { AltButton, PriButton } from '../control';
import { passageRecordSelector } from '../selector';
import Busy from './Busy';

const RecordDialog = styled(Dialog)<DialogProps>(() => ({
  flexGrow: 1,
  '& .MuiDialog-paper': {
    maxWidth: '90%',
    minWidth: '90%',
  },
}));

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
}));

interface IProps {
  visible: boolean;
  onVisible: (visible: boolean) => void;
  onCancel?: (() => void) | undefined;
  mediaId: string;
  artifactId: string | null;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  passageId: string | undefined;
  metaData?: JSX.Element | undefined;
  defaultFilename?: string | undefined;
  ready?: (() => boolean) | undefined;
  allowWave?: boolean | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  team?: string | undefined;
}

function PassageRecordDlg(props: IProps) {
  const {
    visible,
    onVisible,
    mediaId,
    artifactId,
    afterUploadCb,
    passageId,
    defaultFilename,
    onCancel,
    ready,
    metaData,
    allowWave,
    speaker,
    onSpeaker,
    team,
  } = props;
  const [reporter] = useGlobal('errorReporter');
  const [busy, setBusy] = useState(false);
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [hasRights, setHasRights] = useState(false);
  const [dialogWidth, setDialogWidth] = useState<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { startSave } = useContext(UnsavedContext).state;
  const t: IPassageRecordStrings = useSelector(
    passageRecordSelector,
    shallowEqual
  );

  const myToolId = 'PassageRecordDlg';

  const onSaving = () => {
    setBusy(true);
  };

  const onReady = () => {
    setBusy(false);
  };

  const close = () => {
    //reset();
    onVisible(false);
  };

  const handleRights = (hasRights: boolean) => setHasRights(hasRights);
  const handleSpeaker = (speaker: string) => {
    onSpeaker && onSpeaker(speaker);
  };

  useEffect(() => {
    if (mediaId !== mediaState.id) fetchMediaUrl({ id: mediaId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  useEffect(() => setBusy(false), [visible]);

  const updateDialogWidth = useCallback(() => {
    setDialogWidth(getRefWidth(dialogRef));
  }, []);

  useEffect(() => {
    updateDialogWidth();
    window.addEventListener('resize', updateDialogWidth);
    return () => window.removeEventListener('resize', updateDialogWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dialogRef.current]);

  const handleSave = () => {
    startSave(myToolId);
  };
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    if (!busy) close();
  };

  return (
    <RecordDialog
      open={visible}
      onClose={handleCancel}
      aria-labelledby="recDlg"
      disableEnforceFocus
    >
      <DialogTitle id="recDlg">{t.title}</DialogTitle>
      <DialogContent id="recDlgContent" ref={dialogRef}>
        {!busy && (
          <SpeakerName
            name={speaker || ''}
            onRights={handleRights}
            onChange={handleSpeaker}
            team={team}
          />
        )}
        {busy && <Busy />}
        <MediaRecord
          toolId={myToolId}
          artifactId={artifactId}
          passageId={passageId}
          afterUploadCb={afterUploadCb}
          mediaId={mediaId}
          onSaving={onSaving}
          onReady={onReady}
          defaultFilename={defaultFilename}
          allowRecord={hasRights}
          allowWave={allowWave}
          showFilename={allowWave}
          showLoad={true}
          setCanSave={setCanSave}
          setCanCancel={setCanCancel}
          setStatusText={setStatusText}
          width={dialogWidth}
          allowZoom={true}
          allowNoNoise={true}
          allowDeltaVoice={true}
        />
        {metaData}
      </DialogContent>
      <DialogActions>
        <StatusMessage variant="caption">{statusText}</StatusMessage>
        <AltButton id="rec-cancel" onClick={handleCancel} disabled={!canCancel}>
          {t.cancel}
        </AltButton>
        <PriButton
          id="rec-save"
          onClick={handleSave}
          disabled={busy || (ready && !ready()) || !canSave || !hasRights}
        >
          {t.save}
        </PriButton>
      </DialogActions>
    </RecordDialog>
  );
}

export default PassageRecordDlg;
