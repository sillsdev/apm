import { useRef, useState, useEffect } from 'react';
import {
  IMediaActionsStrings,
  IPeerCheckStrings,
  ISharedStrings,
} from '../model';
import {
  mediaActionsSelector,
  peerCheckSelector,
  sharedSelector,
} from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import {
  Box,
  Chip,
  ChipProps,
  IconButton,
  Slider,
  Stack,
  SxProps,
  TooltipProps,
  Typography,
  styled,
} from '@mui/material';
import { LightTooltip } from '../control/LightTooltip';
import ReplayIcon from '@mui/icons-material/Replay';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { Duration } from '../control/Duration';
import HiddenPlayer from './HiddenPlayer';
import { BlobStatus, useFetchMediaBlob } from '../crud/useFetchMediaBlob';
import CloseIcon from '@mui/icons-material/Close';

const StyledDiv = styled('div')({
  '& #hiddenplayer': {
    display: 'none',
  },
});

const StyledChip = styled(Chip)<ChipProps>(({ theme }) => ({
  height: 'auto',
  '&>*': {
    padding: '4px!important',
    margin: '4px!important',
  },
  '& .MuiChip-label': {
    width: 'calc(100% - 20px)',
  },
  '& .MuiChip-deleteIcon': {
    color: theme.palette.action.active,
  },
}));

const StyledTip = styled(LightTooltip)<TooltipProps>(() => ({
  backgroundColor: 'transparent',
}));

interface IMediaLimits {
  start?: number;
  end?: number;
}

interface IProps {
  srcMediaId: string;
  requestPlay: boolean;
  onEnded: () => void;
  noClose?: boolean;
  onTogglePlay?: () => void;
  controls?: boolean;
  limits: IMediaLimits;
  onLoaded?: () => void;
  sx?: SxProps;
  noRestart?: boolean;
  noSkipBack?: boolean;
}

export function LimitedMediaPlayer(props: IProps) {
  const {
    srcMediaId,
    requestPlay,
    onLoaded,
    onEnded,
    noClose,
    onTogglePlay,
    controls,
    limits,
    sx,
    noRestart,
    noSkipBack,
  } = props;
  const [value, setValue] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlayingx] = useState(false);
  const playingRef = useRef(false);
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const [duration, setDurationx] = useState(0);
  const durationRef = useRef(0);
  const valueTracker = useRef<number>(0);
  const stop = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startPos, setStartPos] = useState(0);
  const t: IPeerCheckStrings = useSelector(peerCheckSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tm: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );

  const setDuration = (value: number) => {
    setDurationx(value);
    durationRef.current = value;
  };

  const setPlaying = (play: boolean) => {
    setPlayingx(play);
    playingRef.current = play;
  };

  const startPlay = () => {
    if (playingRef.current) return;
    setPlaying(true);
  };

  const stopPlay = () => {
    if (!playingRef.current) return;
    setPlaying(false);
  };

  const setPosition = (position: number | undefined) => {
    if (position !== undefined && position !== currentTime) {
      setCurrentTime(position);
      setStartPos(position);
    }
  };

  const resetPlay = () => {
    if (playingRef.current) stopPlay();
    setPosition(limits?.start ?? 0);
    setValue(0);
    durationRef.current = 0;
  };

  useEffect(() => {
    resetPlay();

    if (srcMediaId !== blobState?.id) {
      if (ready) setReady(false);
      fetchBlob(srcMediaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcMediaId]);

  useEffect(() => {
    stopPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobState.id]);

  useEffect(() => {
    if (blobState.blobStat === BlobStatus.FETCHED) {
      if (!ready) setReady(true);
      onLoaded && onLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobState]);

  useEffect(() => {
    if (ready && requestPlay) {
      startPlay();
    } else if (!requestPlay) {
      stopPlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestPlay]);

  useEffect(() => {
    setPosition(limits.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limits.start]);

  const handlePlayPause = () => {
    if (onTogglePlay) onTogglePlay();
    if (playingRef.current) {
      stopPlay();
    } else {
      startPlay();
    }
  };

  const ended = () => {
    resetPlay();
    if (onEnded) onEnded();
  };

  const timeUpdate = (progress: number) => {
    const time = Math.round(progress * 1000) / 1000;
    if (stop.current !== 0 && time >= stop.current) {
      ended();
    } else if (
      // We use a tolerance of 0.1 seconds to avoid floating point precision issues.
      // The progress seems to set time to end at the beginning so we test two values.
      durationRef.current - time < 0.1 &&
      durationRef.current - valueTracker.current < 0.1 &&
      valueTracker.current !== 0
    ) {
      ended();
    } else {
      const current = Math.ceil(progress - (limits.start ?? 0));
      if (playingRef.current && valueTracker.current !== current) {
        valueTracker.current = current;
        setValue(current);
        setCurrentTime(time);
      }
    }
  };

  const durationChange = (duration: number) => {
    //this is called multiple times for some files
    if (durationRef.current === 0 && duration) {
      if (limits.end) {
        setPosition(limits.start);
        if (limits.end > duration - 0.5) stop.current = 0;
        else stop.current = limits.end + 0.25;
      } else stop.current = duration;
      setDuration(duration);
    }
  };

  const handleSegmentStart = () => {
    const start = limits.start ?? 0;
    if (start === startPos) {
      setPosition(start + 0.01);
      setTimeout(() => setPosition(start), 100);
    } else setPosition(start);
    stop.current = limits.end ? limits.end + 0.25 : (durationRef.current ?? 0);
    setValue(0);
  };

  const handleSkipBack = () => {
    const newPos = Math.max(currentTime - 3, 0);
    setPosition(newPos);
    const start = limits.start ?? 0;
    const slider = Math.round(newPos - start);
    setValue(slider);
  };

  const handleSliderChange = (e: Event, value: number | number[]) => {
    const curValue = Array.isArray(value) ? value[0] : value;
    const start = limits.start ?? 0;
    setPosition(curValue + start);
    setValue(curValue);
  };

  return ready ? (
    <StyledDiv id="limitedplayer">
      {!controls ? (
        <></>
      ) : (
        <StyledChip
          icon={
            <>
              {!noRestart && (
                <StyledTip title={t.resourceStart}>
                  <IconButton
                    data-testid="segment-start"
                    sx={{ alignSelf: 'center' }}
                    onClick={handleSegmentStart}
                  >
                    <SkipPrevious fontSize="small" />
                  </IconButton>
                </StyledTip>
              )}
              {!noSkipBack && (
                <StyledTip title={t.back3Seconds}>
                  <IconButton
                    data-testid="skip-back"
                    sx={{ alignSelf: 'center' }}
                    onClick={handleSkipBack}
                  >
                    <ReplayIcon fontSize="small" />
                  </IconButton>
                </StyledTip>
              )}
              <StyledTip title={playing ? tm.pause : tm.play}>
                <IconButton
                  data-testid="play-pause"
                  sx={{
                    alignSelf: 'center',
                    color: 'text.primary',
                    m: '0!important',
                    pb: '0!important',
                    pt: '7px!important',
                    pr: '0!important',
                  }}
                  onClick={handlePlayPause}
                >
                  {playing ? (
                    <Pause fontSize="small" sx={{ color: 'text.secondary' }} />
                  ) : (
                    <PlayArrow
                      fontSize="small"
                      sx={{ color: 'text.secondary' }}
                    />
                  )}
                </IconButton>
              </StyledTip>
            </>
          }
          label={
            <Stack direction="row" sx={{ pr: 1, pl: 0 }}>
              <Stack direction="column" sx={{ width: '100%', pl: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '0.7rem', lineHeight: 1 }}>
                    <Duration
                      seconds={(currentTime ?? 0) - (limits.start ?? 0)}
                    />
                    {' / '}
                    <Duration
                      seconds={(limits.end || duration) - (limits.start ?? 0)}
                    />
                  </Typography>
                </Box>
                <Slider
                  value={value}
                  onChange={handleSliderChange}
                  size="small"
                  sx={{ color: 'text.secondary', py: 0.5 }}
                  min={0}
                  max={Math.ceil(
                    (limits.end || duration) - (limits.start ?? 0)
                  )}
                />
              </Stack>
            </Stack>
          }
          deleteIcon={
            !noClose ? (
              <StyledTip title={ts.close}>
                <IconButton
                  data-testid="close"
                  sx={{ alignSelf: 'center' }}
                  onClick={ended}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </StyledTip>
            ) : (
              <></>
            )
          }
          sx={{ ...sx, width: '100%' }}
        />
      )}
      <HiddenPlayer
        onProgress={timeUpdate}
        onDuration={durationChange}
        position={startPos}
        loading={blobState.blobStat === BlobStatus.PENDING}
        audioBlob={blobState.blob}
        playing={playing}
        setPlaying={setPlaying}
      />
    </StyledDiv>
  ) : (
    <></>
  );
}
export default LimitedMediaPlayer;
