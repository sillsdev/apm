import React from 'react';
import { IRow } from '../../../../components/AudioTab';
import { Box, IconButton, Radio, Stack, Typography } from '@mui/material';
import UserAvatar from '../../../../components/UserAvatar';
import { findRecord } from '../../../../crud';
import { IMediaActionsStrings, UserD } from '@model/index';
import { dateOrTime } from '../../../../utils/index';
import { AudioDownload } from '../../../../components/AudioDownload';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import { shallowEqual, useSelector } from 'react-redux';
import { mediaActionsSelector } from '../../../../selector/selectors';
import { useGlobal } from '../../../../context/useGlobal';

interface AudioVersionCardProps extends IRow {
  isSelected: boolean;
  setIsSelected: (selectedId: string) => void;
  lang: string;
  handleSelect: (id: string) => void;
  playItem: string;
  mediaPlaying: boolean;
  showSelectionRadio?: boolean;
}

export const AudioVersionCard: React.FC<AudioVersionCardProps> = (props) => {
  const [memory] = useGlobal('memory');
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  const isPlaying = props.playItem === props.id && props.mediaPlaying;

  return (
    <Box
      data-cy="audio-version-card"
      sx={{
        border: '1px solid gray',
        borderRadius: 2,
        backgroundColor: props.isSelected ? 'lightblue' : 'white',
        my: 1,
        p: 1,
      }}
      onClick={() => props.setIsSelected(props.id)}
    >
      <Stack direction="row">
        <Stack
          direction="column"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
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
          <Typography variant="caption">{props.duration}</Typography>
          <AudioDownload mediaId={props.id} />
        </Stack>
        <Stack
          direction="column"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            px: 1,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Typography
            data-cy="audio-version-file-name"
            variant="subtitle1"
            sx={{
              fontWeight: 'bold',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {props.fileName}
          </Typography>
          <Typography variant="body2">{props.reference}</Typography>
          <Typography variant="caption">
            {dateOrTime(props.date, props.lang)}
          </Typography>
          <Typography variant="caption">
            {(props.size / (1024 * 1024)).toFixed(2)} MB
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <UserAvatar
            userRec={findRecord(memory, 'user', props.user) as UserD}
          />
        </Box>
        {props.showSelectionRadio && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pl: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Radio
              checked={props.isSelected}
              onChange={() => props.setIsSelected(props.id)}
              value={props.id}
              size="small"
              inputProps={{ 'aria-label': props.fileName }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default AudioVersionCard;
