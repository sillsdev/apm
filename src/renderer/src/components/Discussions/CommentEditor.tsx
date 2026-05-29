import {
  Box,
  Button,
  TextField,
  Tooltip,
  styled,
  Typography,
  TypographyProps,
} from '@mui/material';
import { useContext, useEffect, useRef, useState } from 'react';
import SendIcon from '@mui/icons-material/Send';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import MicIcon from '@mui/icons-material/MicOutlined';
import { waitForIt } from '../../utils';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import MediaRecord from '../MediaRecord';
import { ICommentEditorStrings, ISharedStrings } from '../../model';
import { useSelector, shallowEqual } from 'react-redux';
import { commentEditorSelector, sharedSelector } from '../../selector';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useArtifactType } from '../../crud';

const RowDiv = styled('div')(() => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  minWidth: 0,
}));

const ColumnDiv = styled('div')(() => ({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  width: '100%',
}));

const StatusMessage = styled(Typography)<TypographyProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  alignSelf: 'center',
  color: theme.palette.primary.dark,
}));

interface IStateProps {}
interface IProps extends IStateProps {
  toolId: string;
  passageId: string;
  comment: string;
  fileName: string;
  cancelOnlyIfChanged?: boolean;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  refresh: number;
  onOk?: () => void;
  onCancel?: () => void;
  setCanSaveRecording: (canSave: boolean) => void;
  onTextChange: (txt: string) => void;
  onAudioDraftChange?: (hasDraft: boolean) => void;
}
export const CommentEditor = (props: IProps) => {
  const {
    toolId,
    passageId,
    comment,
    fileName,
    cancelOnlyIfChanged,
    afterUploadCb,
    refresh,
    onOk,
    onCancel,
    setCanSaveRecording,
    onTextChange,
    onAudioDraftChange,
  } = props;
  const {
    playing,
    itemPlaying,
    commentPlaying,
    commentRecording,
    setCommentRecording,
  } = useContext(PassageDetailContext).state;
  const t: ICommentEditorStrings = useSelector(
    commentEditorSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const [canSave, setCanSave] = useState(false);
  const canSaveRef = useRef(false);
  const [curText, setCurText] = useState(comment);
  const [startRecord, setStartRecord] = useState(false);
  const [statusText, setStatusText] = useState('');
  const doRecordRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [myChanged, setMyChanged] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const { commentId } = useArtifactType();

  const {
    toolsChanged,
    toolChanged,
    startSave,
    saveRequested,
    clearRequested,
    clearCompleted,
    isChanged,
  } = useContext(UnsavedContext).state;

  const setAudioDraft = (hasDraft: boolean) => {
    onAudioDraftChange?.(hasDraft);
  };

  const clearUnsavedIfEmpty = () => {
    if (!curText.length && !canSaveRef.current) {
      toolChanged(toolId, false);
    }
  };

  useEffect(() => {
    return () => {
      if (doRecordRef.current) setCommentRecording(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const changed = isChanged(toolId);
    if (myChanged !== changed) setMyChanged(changed);
    if (saveRequested(toolId)) handleOk();
    else if (clearRequested(toolId)) handleCancel();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged, toolId]);

  useEffect(() => {
    if (startRecord)
      try {
        waitForIt(
          'stop playing',
          () => !playing && !itemPlaying && !commentPlaying,
          () => false,
          100
        ).then(() => {
          doRecordRef.current = true;
          setShowRecorder(true);
          setStartRecord(false);
        });
      } catch {
        //do it anyway...
        doRecordRef.current = true;
        setShowRecorder(true);
        setStartRecord(false);
      }
  }, [startRecord, playing, itemPlaying, commentPlaying]);

  const handleSetCanSave = (valid: boolean) => {
    if (valid !== canSaveRef.current) {
      canSaveRef.current = valid;
      setCanSave(valid);
      setCanSaveRecording(valid);
      setAudioDraft(valid);
      if (valid) toolChanged(toolId, true);
      else clearUnsavedIfEmpty();
    }
  };
  const onRecording = (r: boolean) => {
    setRecording(r);
    if (r) {
      toolChanged(toolId, true);
    } else if (doRecordRef.current) {
      // Paused/stopped: enable parent Add before blob-ready/canSave propagates (TT-7216).
      setAudioDraft(true);
    }
  };
  const handleTextChange = (e: any) => {
    setCurText(e.target.value);
    onTextChange(e.target.value);
    toolChanged(toolId, true);
  };

  const handleOk = () => {
    //start the passage recorder if it's going...
    startSave(toolId);

    onOk && onOk();
    setStatusText(t.saving);
    if (doRecordRef.current) setCommentRecording(false);
  };
  const handleCancel = () => {
    onCancel && onCancel();
    reset();
  };

  const handleRecord = () => {
    toolChanged(toolId, true);
    setStartRecord(true);
    setCommentRecording(true);
  };

  const reset = () => {
    if (doRecordRef.current) setCommentRecording(false);
    setStatusText('');
    setCurText('');
    doRecordRef.current = false;
    setShowRecorder(false);
    canSaveRef.current = false;
    setCanSave(false);
    setCanSaveRecording(false);
    setAudioDraft(false);
    clearCompleted(toolId);
    clearUnsavedIfEmpty();
  };

  useEffect(() => {
    if (refresh > 0) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const recorderNode = (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <MediaRecord
        toolId={toolId}
        passageId={passageId}
        artifactId={commentId}
        onRecording={onRecording}
        afterUploadCb={afterUploadCb}
        defaultFilename={fileName}
        allowWave={false}
        setCanSave={handleSetCanSave}
        setStatusText={setStatusText}
        height={40}
        width={400}
        autoStart={true}
        allowDeltaVoice={false}
        allowNoNoise={false}
        allowZoom={false}
        keepItSmall={true}
        oneTryOnly={false}
        hideToolbar={true}
        hideSegmentControls={true}
        showSize={false}
      />
    </Box>
  );

  const actionButtons =
    onOk &&
    (!cancelOnlyIfChanged || doRecordRef.current || myChanged) && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1px',
          flexWrap: 'wrap',
        }}
      >
        <Tooltip title={ts.cancel}>
          <span>
            <Button
              id="cancel"
              onClick={handleCancel}
              sx={{
                color: 'background.paper',
                minWidth: 'auto',
                padding: '2px 4px',
              }}
              disabled={recording}
            >
              <CancelIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={ts.save}>
          <span>
            <Button
              id="ok"
              onClick={handleOk}
              sx={{
                color: 'background.paper',
                minWidth: 'auto',
                padding: '2px 4px',
              }}
              disabled={
                (!canSave && !curText.length) || !myChanged || recording
              }
            >
              <SendIcon />
            </Button>
          </span>
        </Tooltip>
      </Box>
    );

  return (
    <ColumnDiv id="commentedit">
      <TextField
        margin="dense"
        id="commenttext"
        value={curText}
        onChange={handleTextChange}
        fullWidth
        multiline
        label={t.comment}
        focused
      />
      {showRecorder ? (
        <ColumnDiv style={{ gap: '8px', marginTop: '4px' }}>
          {recorderNode}
          <RowDiv
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            {actionButtons}
            <StatusMessage variant="caption">{statusText}</StatusMessage>
          </RowDiv>
        </ColumnDiv>
      ) : (
        <RowDiv>
          <Tooltip title={commentRecording ? t.recordUnavailable : t.record}>
            <span>
              <Button
                id="record"
                onClick={handleRecord}
                disabled={commentRecording}
              >
                <MicIcon />
              </Button>
            </span>
          </Tooltip>
          <div>
            <StatusMessage variant="caption">{statusText}</StatusMessage>
            {actionButtons}
          </div>
        </RowDiv>
      )}
    </ColumnDiv>
  );
};
