import { Chip, CircularProgress, IconButton } from '@mui/material';
import { LightTooltip } from './LightTooltip';
import PlayIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useMemo } from 'react';
import { startEnd } from '../utils';
import { useMiniAudio } from '../utils/useMiniAudio';
import { commentCardSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { ICommentCardStrings } from '../model';

interface IProps {
  id: string;
  oldVernVer?: number;
  mediaId: string;
  text: string;
}

/**
 * For a discussion or comment made on an earlier version of the passage
 * recording: shows that version number and plays/stops the part of the old
 * recording the discussion is about.
 */
// TODO cleanup: Should we move this to use the MiniAudioPlayer component?
export function OldVernVersion({ id, oldVernVer, mediaId, text }: IProps) {
  const t: ICommentCardStrings = useSelector(commentCardSelector, shallowEqual);

  const myRegion = useMemo(() => startEnd(text), [text]);
  const player = useMiniAudio({
    mediaId: oldVernVer ? mediaId : '',
    clip: { start: myRegion?.start ?? 0, end: myRegion?.end ?? 0 },
  });
  // Stop, not pause: the next play starts the clip over.
  const handleClick = () => {
    if (player.playing || player.loading) {
      player.pause();
      player.seek(0);
    } else player.play();
  };

  return oldVernVer ? (
    <>
      <LightTooltip title={t.previousVersion}>
        <Chip label={oldVernVer.toString()} size="small" />
      </LightTooltip>
      <LightTooltip title={t.playOrStop}>
        <IconButton
          id={`play-${id}`}
          size="small"
          onClick={handleClick}
          sx={{ p: '3px', m: '5px' }}
        >
          {player.loading ? (
            <CircularProgress size={16} />
          ) : player.playing ? (
            <StopIcon fontSize="small" />
          ) : (
            <PlayIcon fontSize="small" />
          )}
        </IconButton>
      </LightTooltip>
    </>
  ) : (
    <></>
  );
}
