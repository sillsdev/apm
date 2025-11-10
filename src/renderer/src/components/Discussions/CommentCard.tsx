import {
  Box,
  BoxProps,
  Checkbox,
  FormControlLabel,
  FormLabel,
  IconButton,
  Slider,
  Stack,
  styled,
  TextField,
  TextFieldProps,
  Tooltip,
} from '@mui/material';
import { shallowEqual } from 'react-redux';
import {
  CommentD,
  DiscussionD,
  ICommentCardStrings,
  MediaFileD,
  IMediaActionsStrings,
  UserD,
} from '../../model';
import Confirm from '../AlertDialog';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  findRecord,
  PermissionName,
  related,
  usePermissions,
} from '../../crud';
import PlayIcon from '@mui/icons-material/PlayArrow';
import UserAvatar from '../UserAvatar';
import { dateOrTime } from '../../utils';
import { useGlobal } from '../../context/useGlobal';
import { CommentEditor } from './CommentEditor';
import DiscussionMenu from './DiscussionMenu';
import { useRecordComment } from './useRecordComment';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { PlayInPlayer } from '../../context/PlayInPlayer';
import { useSaveComment } from '../../crud/useSaveComment';
import { UnsavedContext } from '../../context/UnsavedContext';
import { OldVernVersion } from '../../control/OldVernVersion';
import { useArtifactType } from '../../crud';
import { useSelector } from 'react-redux';
import { commentCardSelector, mediaActionsSelector } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import LimitedMediaPlayer from '../LimitedMediaPlayer';

const StyledWrapper = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  flexGrow: 1,
  width: '100%',
  '&:hover button': {
    color: 'primary',
  },
  '& .MuiTypography-root': {
    cursor: 'default ',
  },
}));

const BoxSpread = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  width: '100%',
  flexGrow: 1,
  justifyContent: 'space-between',
}));
const BoxRow = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  flexDirection: 'row',
  flexGrow: 1,
  width: '100%',
}));
const BoxBorderRow = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  flexGrow: 1,
  borderTop: '1px solid #dfdfdf',
}));
const MediaCol = styled(Box)<BoxProps>(({ theme }) => ({
  display: 'flex',
  width: '100%',
  flexGrow: 1,
  flexDirection: 'column',
  justifyContent: 'center',
  color: theme.palette.primary.dark,
  '& .MuiChip-filled': {
    backgroundColor: 'transparent',
  },
  '& audio': {
    width: '100%',
    flexGrow: 1,
    marginTop: theme.spacing(1),
    height: '40px',
  },
}));

const StyledText = styled(TextField)<TextFieldProps>(() => ({
  wordBreak: 'break-word',
  '& .MuiInput-underline:before': {
    content: 'none',
  },
}));

interface IProps {
  comment: CommentD;
  discussion: DiscussionD;
  commentNumber: number;
  onEditing: (val: boolean) => void;
  approvalStatus: boolean | undefined;
}

export const CommentCard = (props: IProps) => {
  const { comment, discussion, commentNumber, onEditing, approvalStatus } =
    props;
  const users = useOrbitData<UserD[]>('user');
  const t: ICommentCardStrings = useSelector(commentCardSelector, shallowEqual);
  const [author, setAuthor] = useState<UserD>();
  const [lang] = useGlobal('lang');
  const [user] = useGlobal('user');
  const [memory] = useGlobal('memory');
  const savingRef = useRef(false);
  const {
    setSelected,
    commentPlaying,
    setCommentPlaying,
    commentPlayId,
    handleCommentPlayEnd,
    handleCommentTogglePlay,
  } = useContext(PassageDetailContext).state;
  const {
    toolChanged,
    toolsChanged,
    saveCompleted,
    saveRequested,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const [editing, setEditing] = useState(false);
  const [canSaveRecording, setCanSaveRecording] = useState(false);
  const [editComment, setEditComment] = useState('');
  const [confirmAction, setConfirmAction] = useState('');
  const [approved, setApprovedx] = useState(approvalStatus);
  const approvedRef = useRef(approvalStatus);
  const { IsVernacularMedia } = useArtifactType();
  const setApproved = (value: boolean) => {
    setApprovedx(value);
    approvedRef.current = value;
  };
  const { getMentorAuthor, hasPermission } = usePermissions();
  const tm: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );

  const CommentAuthor = (comment: CommentD) =>
    getMentorAuthor(comment.attributes.visible) ??
    related(comment, 'creatorUser') ??
    related(comment, 'lastModifiedByUser');

  const reset = () => {
    setEditing(false);
    saveCompleted(comment.id);
    onEditing(false);
    setChanged(false);
    savingRef.current = false;
  };

  const resetAfterError = () => {
    savingRef.current = false;
    saveCompleted(comment.id);
  };
  const setChanged = (changed: boolean) => {
    const valid = editComment !== '' || canSaveRecording;
    toolChanged(comment.id, changed && valid);
  };

  const saveComment = useSaveComment();

  const doSaveComment = async (mediaId: string | undefined) => {
    await saveComment(
      discussion.id,
      comment.id,
      editComment,
      mediaId,
      approvedRef.current,
      comment.attributes?.visible
    );
    reset();
  };
  const afterUploadCb = async (mediaId: string | undefined) => {
    if (mediaId) doSaveComment(mediaId);
    else resetAfterError();
  };
  const { passageId, fileName } = useRecordComment({
    mediafileId: related(discussion, 'mediafile'),
    commentNumber,
  });
  const text = comment.attributes?.commentText;
  const [mediaId, setMediaId] = useState('');
  const [oldVernVer, setOldVernVer] = useState(0);

  useEffect(() => {
    setEditComment(comment.attributes.commentText);
  }, [comment]);

  useEffect(() => {
    if (saveRequested(comment.id) && !savingRef.current) {
      handleSaveEdit();
    } else if (clearRequested(comment.id)) handleCancelEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  useEffect(() => {
    if (canSaveRecording) {
      setChanged(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSaveRecording]);

  const handleCommentAction = (what: string) => {
    if (what === 'edit') {
      setEditing(true);
      onEditing(true);
    } else if (what === 'delete') {
      setConfirmAction(what);
    }
  };
  const handleDelete = () => {
    memory.update((t) =>
      t.removeRecord({
        type: 'comment',
        id: comment.id,
      })
    );
    reset();
  };

  const handleActionConfirmed = () => {
    if (confirmAction === 'delete') {
      handleDelete();
    }
    setConfirmAction('');
  };

  const handleActionRefused = () => {
    setConfirmAction('');
  };

  const handleSaveEdit = (approvedChange?: boolean) => {
    if (!savingRef.current) {
      savingRef.current = true;
      //if we're recording and can save, the comment will save after upload
      if (!canSaveRecording) {
        if (editComment.length > 0 || approvedChange) doSaveComment('');
        else saveCompleted(comment.id);
      }
    }
  };
  const handleCancelEdit = () => {
    reset();
    clearCompleted(comment.id);
  };

  const handleTextChange = (newText: string) => {
    setEditComment(newText);
    setChanged(true);
  };
  const handleApprovedChange = () => {
    setApproved(!approvedRef.current);
    handleSaveEdit(true);
  };
  const media = useMemo(() => {
    if (!mediaId || mediaId === '') return null;
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      | MediaFileD
      | undefined;
    if (mediaRec) {
      if (IsVernacularMedia(mediaRec)) {
        setOldVernVer(mediaRec.attributes?.versionNumber);
      }
    }
    return mediaRec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, mediaId]);

  const handlePlayComment = () => {
    if (mediaId === commentPlayId) setCommentPlaying(!commentPlaying);
    else setSelected(mediaId, PlayInPlayer.no);
  };

  useEffect(() => {
    if (users) {
      const u = users.filter((u) => u.id === CommentAuthor(comment));
      if (u.length > 0) setAuthor(u[0]);
    }
    setMediaId(related(comment, 'mediafile'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, users]);

  return (
    <StyledWrapper>
      <BoxBorderRow>
        <Box width="100%" flexGrow={1} display="flex" flexDirection="column">
          <BoxSpread>
            <Box
              id="user"
              sx={{
                margin: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <UserAvatar {...props} userRec={author} small={true} />
              <Box id="author">{author?.attributes?.name}</Box>
              <Box id="datecreated">
                {dateOrTime(comment.attributes.dateUpdated, lang)}
              </Box>
            </Box>
            {approvalStatus !== undefined &&
              (hasPermission(PermissionName.Mentor) ? (
                <FormControlLabel
                  sx={
                    approved
                      ? { color: 'secondary.light' }
                      : { color: 'warning.dark' }
                  }
                  control={
                    <Checkbox
                      id="checkbox-approved"
                      checked={approved}
                      onChange={handleApprovedChange}
                    />
                  }
                  label={approved ? t.approved : t.approve}
                  labelPlacement="top"
                />
              ) : (
                !approved && (
                  <FormLabel id="unapproved" color="secondary">
                    {t.unapproved}
                  </FormLabel>
                )
              ))}
            {mediaId !== commentPlayId &&
              author?.id === user &&
              !oldVernVer && (
                <Box>
                  <DiscussionMenu
                    action={handleCommentAction}
                    canResolve={true}
                    canEdit={true}
                  />
                </Box>
              )}
          </BoxSpread>
          <BoxRow>
            {commentPlayId && mediaId === commentPlayId ? (
              <MediaCol id="commentplayer">
                <LimitedMediaPlayer
                  srcMediaId={mediaId === commentPlayId ? commentPlayId : ''}
                  requestPlay={commentPlaying}
                  onEnded={handleCommentPlayEnd}
                  onTogglePlay={handleCommentTogglePlay}
                  controls={mediaId === commentPlayId}
                  limits={{ start: 0, end: media?.attributes?.duration }}
                  noRestart={true}
                  noSkipBack={true}
                  noClose={true}
                />
              </MediaCol>
            ) : media && (!oldVernVer || oldVernVer === 0) ? (
              <Stack
                direction="row"
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Tooltip title={tm.play}>
                  <IconButton
                    id="playcomment"
                    onClick={handlePlayComment}
                    sx={{ p: 0 }}
                  >
                    <PlayIcon fontSize="small" sx={{ color: 'text.primary' }} />
                  </IconButton>
                </Tooltip>
                <Stack direction="row" sx={{ width: '100%', pr: 2, pl: 1 }}>
                  <Slider
                    sx={{ color: 'text.secondary' }}
                    size="small"
                    onClick={handlePlayComment}
                  />
                </Stack>
              </Stack>
            ) : (
              <></>
            )}
          </BoxRow>
          <Box>
            {editing ? (
              <CommentEditor
                toolId={comment.id}
                passageId={passageId}
                refresh={0}
                comment={comment.attributes?.commentText}
                onCancel={handleCancelEdit}
                onOk={handleSaveEdit}
                setCanSaveRecording={setCanSaveRecording}
                onTextChange={handleTextChange}
                fileName={fileName(
                  discussion.attributes.subject,
                  discussion.id
                )}
                afterUploadCb={afterUploadCb}
              />
            ) : text ? (
              <>
                <OldVernVersion
                  id={comment.id}
                  oldVernVer={oldVernVer}
                  mediaId={mediaId}
                  text={text}
                />
                <StyledText
                  id="outlined-textarea"
                  value={text}
                  multiline
                  fullWidth
                  variant="standard"
                />
              </>
            ) : (
              <></>
            )}
          </Box>
        </Box>
      </BoxBorderRow>

      {confirmAction === '' || (
        <Confirm
          text={t.confirmDelete}
          yesResponse={handleActionConfirmed}
          noResponse={handleActionRefused}
        />
      )}
    </StyledWrapper>
  );
};
export default CommentCard;
