import React from 'react';
import { FaPaperclip, FaUnlink } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';
import { shallowEqual, useSelector } from 'react-redux';
import { Box, IconButton, Radio, Stack, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import {
  IMediaActionsStrings,
  IMediaTabStrings,
  ITranscriptionShowStrings,
  UserD,
} from '@model/index';
import { useGlobal } from '../../../../context/useGlobal';
import { dateOrTime } from '../../../../utils/index';
import { findRecord, related } from '../../../../crud';
import { useTranscription } from '../../../../crud/useTranscription';
import {
  mediaActionsSelector,
  mediaTabSelector,
  transcriptionShowSelector,
} from '../../../../selector/selectors';
import { WrapTitle } from '../../../../control/WrapTitle';
import { AudioDownload } from '../../../../components/AudioDownload';
import { IRow } from '../../../../components/AudioTab';
import UserAvatar from '../../../../components/UserAvatar';
import { Button } from '../../../../control/Button';

const Paperclip = FaPaperclip as unknown as React.FC<IconBaseProps>;
const Unlink = FaUnlink as unknown as React.FC<IconBaseProps>;

interface AudioVersionCardProps extends IRow {
  isSelected: boolean;
  setIsSelected: (selectedId: string) => void;
  lang: string;
  handleSelect: (id: string) => void;
  playItem: string;
  mediaPlaying: boolean;
  showSelectionRadio?: boolean;
  /** Opens the transcription dialog for this row (same as reference in AudioTable). */
  onShowTranscription?: () => void;
  /** Which card is showing a wrapped, full file name (only one at a time). */
  expandedFileNameId?: string | null;
  setExpandedFileNameId?: (id: string | null) => void;
  /** Select this version and expand its file name (avoids clearing expansion in the same gesture). */
  expandFileNameForMedia?: (id: string) => void;
  /** When set, clicking the card surface selects this row (version picker). */
  onSelectCard?: () => void;
  /** Media sheet: section column label + value */
  showMediaSheetMetadata?: boolean;
  sectionLabel?: string;
  showAttachControl?: boolean;
  onAttachToggle?: React.MouseEventHandler;
  attached?: boolean;
  /** When false, play control is hidden (matches former PlayCell rules). */
  allowPlay?: boolean;
  /** When false, download is hidden (matches former DetachCell rules). */
  allowDownload?: boolean;
  canDeleteMedia?: boolean;
  onRequestDelete?: (e: React.MouseEvent) => void;
  showPublishControl?: boolean;
  publishDisabled?: boolean;
  onPublishClick?: (e: React.MouseEvent) => void;
  publishStatusIcon?: React.ReactNode;
}

export const AudioVersionCard: React.FC<AudioVersionCardProps> = (props) => {
  const [memory] = useGlobal('memory');
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  const ts: ITranscriptionShowStrings = useSelector(
    transcriptionShowSelector,
    shallowEqual
  );
  const tm: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const parsedVersion = props.version ? parseInt(props.version, 10) : NaN;
  const versionNum = Number.isFinite(parsedVersion) ? parsedVersion : undefined;
  const getTranscription = useTranscription(true, undefined, versionNum);
  const mediaRec = findRecord(memory, 'mediafile', props.id);
  const passageId = related(mediaRec, 'passage') || props.id;
  const hasTranscription = Boolean(getTranscription(passageId)?.trim());
  const isPlaying = props.playItem === props.id && props.mediaPlaying;
  const allowPlay = props.allowPlay !== false;
  const allowDownload = props.allowDownload !== false;

  return (
    <Stack direction="row" alignItems="center">
      <Box
        data-cy="audio-version-card"
        sx={{
          border: '1px solid gray',
          borderRadius: 2,
          backgroundColor: props.isSelected ? 'lightblue' : 'white',
          flex: 1,
          minWidth: 0,
          p: 1,
        }}
        onClick={props.onSelectCard}
      >
        <Stack
          direction="row"
          sx={{
            width: '100%',
            minWidth: 0,
            alignItems: 'flex-start',
          }}
        >
          <Stack
            direction="column"
            alignItems="center"
            sx={{
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}
          >
            {props.showAttachControl && props.onAttachToggle && (
              <IconButton
                id="audActAttach"
                sx={{ color: 'primary.light' }}
                title={props.attached ? t.detach : t.attach}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onAttachToggle?.(e);
                }}
              >
                {props.attached ? (
                  <Unlink fontSize="16px" />
                ) : (
                  <Paperclip fontSize="16px" />
                )}
              </IconButton>
            )}
            {allowPlay && (
              <IconButton
                id="audActPlayStop"
                sx={{ color: 'primary.light' }}
                title={isPlaying ? t.pause : t.play}
                disabled={(props.id || '') === ''}
                onClick={(e) => {
                  e.stopPropagation();
                  props.handleSelect(props.id);
                }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            )}
            <Typography variant="caption">{props.duration}</Typography>
            <Box
              sx={{
                mt: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 0.5,
                lineHeight: 0,
                flexWrap: 'wrap',
              }}
            >
              {allowDownload && <AudioDownload mediaId={props.id} />}
              {props.canDeleteMedia && props.onRequestDelete && (
                <IconButton
                  id="audActDel"
                  sx={{ color: 'primary.light' }}
                  title={t.delete}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRequestDelete?.(e);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          </Stack>
          <Stack
            direction="column"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              px: 1,
              flex: '1 1 0%',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <WrapTitle
              id={props.id}
              expandedId={props.expandedFileNameId}
              setExpandedId={(idOrNull) => {
                if (!props.setExpandedFileNameId) return;
                if (idOrNull === props.id && props.expandFileNameForMedia) {
                  props.expandFileNameForMedia(props.id);
                  return;
                }
                props.setExpandedFileNameId(idOrNull);
              }}
              dataCy="audio-version-file-name"
            >
              {props.fileName}
            </WrapTitle>
            <Typography
              variant="body2"
              component="div"
              sx={{
                // props.reference renders RefRender, which wraps its text in a
                // Typography span hard-coded to nowrap/ellipsis with a 200px cap.
                // Override those so long references wrap inside the card.
                '& .MuiTypography-root': {
                  whiteSpace: 'normal',
                  overflow: 'visible',
                  textOverflow: 'clip',
                  maxWidth: 'none',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                },
              }}
            >
              {props.reference}
            </Typography>
            {props.showMediaSheetMetadata && props.sectionDesc ? (
              <Typography variant="caption" color="text.secondary">
                {props.sectionLabel
                  ? `${props.sectionLabel}: ${props.sectionDesc}`
                  : props.sectionDesc}
              </Typography>
            ) : null}
            {props.showPublishControl && (
              <Button
                variant="text"
                size="small"
                color="primary"
                disabled={props.publishDisabled}
                startIcon={
                  <Box component="span" sx={{ display: 'inline-flex' }}>
                    {props.publishStatusIcon}
                  </Box>
                }
                onClick={(e) => {
                  e.stopPropagation();
                  props.onPublishClick?.(e);
                }}
                sx={{
                  mt: 0.25,
                  px: 0.5,
                  minWidth: 0,
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                }}
              >
                {props.readyToShare ? tm.published : tm.publish}
              </Button>
            )}
            {hasTranscription && props.onShowTranscription && (
              <Button
                variant="text"
                size="small"
                color="primary"
                startIcon={<DescriptionOutlined sx={{ fontSize: 18 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onShowTranscription?.();
                }}
                sx={{
                  mt: 0.25,
                  px: 0.5,
                  minWidth: 0,
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                }}
              >
                {ts.transcription}
              </Button>
            )}
            <Typography variant="caption">
              {dateOrTime(props.date, props.lang)}
            </Typography>
            <Typography variant="caption">
              {Number(props.size).toFixed(2)} MB
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}
          >
            <UserAvatar
              userRec={findRecord(memory, 'user', props.user) as UserD}
            />
          </Box>
        </Stack>
      </Box>
      {props.showSelectionRadio && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Radio
            checked={props.isSelected}
            onChange={() => props.setIsSelected(props.id)}
            value={props.id}
            size="small"
            slotProps={{ input: { 'aria-label': props.fileName } }}
          />
        </Box>
      )}
    </Stack>
  );
};

export default AudioVersionCard;
