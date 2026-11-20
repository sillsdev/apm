import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  Box,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  SxProps,
  Typography,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import { IMediaActionsStrings } from '../model';
import { mediaActionsSelector } from '../selector';
import { LightTooltip } from '../control/LightTooltip';
import { Duration } from '../control/Duration';
import { useMiniAudio } from '../utils/useMiniAudio';
import type { TimeRange } from '../control/formatTime';

// TODO cleanup after we switch PassageDetailArtifacts to the new design: its
// toolbar player is the only user of this ref handle; remove it along with
// forwardRef and useImperativeHandle below.
export interface MiniAudioPlayerHandle {
  play: () => void;
  pause: () => void;
  toggle: () => void;
}

interface IProps {
  srcMediaId: string;
  clip?: TimeRange;
  onFinish?: () => void;
  // TODO cleanup after we switch PassageDetailArtifacts to the new design: its
  // toolbar player is the only user; remove this and the effect below.
  onPlayingChange?: (playing: boolean) => void;
  playButtonSize?: 'small' | 'medium' | 'large';
  sx?: SxProps;
}

/**
 * A play/pause button and a position slider for one media file, or a clip of
 * one. Nothing is downloaded until the first play, and only one player (across
 * the app, via audioManager) plays at a time.
 */
// TODO cleanup after we switch PassageDetailArtifacts to the new design: make
// this a plain function component once the ref handle is gone.
export const MiniAudioPlayer = forwardRef<MiniAudioPlayerHandle, IProps>(
  function MiniAudioPlayer(
    {
      srcMediaId,
      clip,
      onFinish,
      onPlayingChange,
      playButtonSize = 'medium',
      sx,
    },
    ref
  ) {
    const player = useMiniAudio({
      mediaId: srcMediaId,
      clip,
      onFinish,
    });
    const tm: IMediaActionsStrings = useSelector(
      mediaActionsSelector,
      shallowEqual
    );

    // TODO cleanup after we switch PassageDetailArtifacts to the new design
    useImperativeHandle(
      ref,
      () => ({ play: player.play, pause: player.pause, toggle: player.toggle }),
      [player.play, player.pause, player.toggle]
    );

    // TODO cleanup after we switch PassageDetailArtifacts to the new design
    useEffect(() => {
      onPlayingChange?.(player.playing);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [player.playing]);

    const handleSeek = (_: Event, value: number | number[]) =>
      player.seek(Array.isArray(value) ? value[0] : value);

    return (
      <Stack
        direction="row"
        sx={[
          { alignItems: 'center', width: '100%', gap: 0.5 },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <LightTooltip title={player.playing ? tm.pause : tm.play}>
          <IconButton
            data-testid="play-pause"
            aria-label={player.playing ? tm.pause : tm.play}
            onClick={player.toggle}
            sx={{ p: 0.5 }}
          >
            {player.loading ? (
              <CircularProgress
                data-testid="loading"
                size={playButtonSize === 'large' ? 30 : 20}
              />
            ) : player.playing ? (
              <Pause fontSize={playButtonSize} />
            ) : (
              <PlayArrow fontSize={playButtonSize} />
            )}
          </IconButton>
        </LightTooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="div"
            sx={{ fontSize: '0.7rem', lineHeight: 1, textAlign: 'right' }}
          >
            <Duration seconds={player.position} />
            {' / '}
            <Duration seconds={player.length} />
          </Typography>
          <Slider
            size="small"
            value={Math.min(player.position, player.length)}
            min={0}
            max={player.length}
            step={0.01}
            disabled={player.length <= 0}
            onChange={handleSeek}
            sx={{ color: 'text.secondary', py: 0.5, touchAction: 'pan-y' }}
          />
        </Box>
      </Stack>
    );
  }
);

export default MiniAudioPlayer;
