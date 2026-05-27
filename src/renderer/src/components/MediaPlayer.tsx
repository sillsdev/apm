import { useRef, useState, useEffect, useCallback } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useFetchMediaUrl, MediaSt } from '../crud';
import { remoteIdGuid } from '../crud/remoteId';
import { findRecord } from '../crud/tryFindRecord';
import { BlobStatus, useFetchMediaBlob } from '../crud/useFetchMediaBlob';
import { logError, Severity } from '../utils';
import { shouldUseWaveSurferPlayback } from '../utils/audioPlayback';
import { useSnackBar } from '../hoc/SnackBar';
import { IPeerCheckStrings, ISharedStrings, MediaFileD } from '../model';
import { peerCheckSelector, sharedSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IconButton,
  Stack,
  StackProps,
  SxProps,
  TooltipProps,
  styled,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LightTooltip } from '../control/LightTooltip';
import ReplayIcon from '@mui/icons-material/Replay';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import HiddenPlayer from './HiddenPlayer';
import { RecordKeyMap } from '@orbit/records';

const StyledTip = styled(LightTooltip)<TooltipProps>(() => ({
  backgroundColor: 'transparent',
}));

const StyledStack = styled(Stack)<StackProps>(() => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  '& audio': {
    width: '100%',
  },
}));

const StyledHidden = styled('div')({
  '& #hiddenplayer': {
    display: 'none',
  },
});

type PlaybackMode = 'pending' | 'native' | 'wavesurfer';

interface IProps {
  srcMediaId: string;
  requestPlay: boolean;
  onEnded: () => void;
  onTogglePlay?: () => void;
  onCancel?: () => void;
  controls?: boolean;
  onLoaded?: () => void;
  sx?: SxProps;
}

export function MediaPlayer(props: IProps) {
  const {
    srcMediaId,
    requestPlay,
    onLoaded,
    onEnded,
    onTogglePlay,
    controls,
    sx,
  } = props;
  const [reporter] = useGlobal('errorReporter');
  const [memory] = useGlobal('memory');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSuccess = useRef(false);
  const [playing, setPlayingx] = useState(false);
  const playingRef = useRef(false);
  const [playItem, setPlayItem] = useState('');
  const [ready, setReady] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('pending');
  const durationSet = useRef(false);
  const nativeErrorHandled = useRef(false);
  const durationRef = useRef(0);
  const valueTracker = useRef(0);
  const stop = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startPos, setStartPos] = useState(0);
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: IPeerCheckStrings = useSelector(peerCheckSelector, shallowEqual);

  const setPlaying = (x: boolean) => {
    setPlayingx(x);
    playingRef.current = x;
  };

  const resolveMediaFileId = useCallback(
    (mediaId: string) => {
      if (!mediaId) return '';
      if (!isNaN(Number(mediaId)) && memory?.keyMap?.keyToId) {
        return (
          (remoteIdGuid(
            'mediafile',
            mediaId,
            memory.keyMap as RecordKeyMap
          ) as string) || mediaId
        );
      }
      return mediaId;
    },
    [memory]
  );

  const getMediaContentType = useCallback(
    (mediaId: string) => {
      const id = resolveMediaFileId(mediaId);
      const rec = findRecord(memory, 'mediafile', id) as MediaFileD | undefined;
      return rec?.attributes?.contentType ?? '';
    },
    [memory, resolveMediaFileId]
  );

  const resetWaveSurferTiming = () => {
    durationRef.current = 0;
    valueTracker.current = 0;
    stop.current = 0;
    setCurrentTime(0);
    setStartPos(0);
  };

  const switchToWaveSurfer = useCallback(() => {
    setReady(false);
    setPlaybackMode('wavesurfer');
    fetchBlob(srcMediaId);
  }, [fetchBlob, srcMediaId]);

  useEffect(() => {
    if (playingRef.current) {
      if (playbackMode === 'native' && audioRef.current) {
        if (playSuccess.current) audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      stopPlay();
    }
    if (srcMediaId !== playItem) {
      durationSet.current = false;
      nativeErrorHandled.current = false;
      resetWaveSurferTiming();
      setPlaybackMode('pending');
      setReady(false);
      fetchMediaUrl({ id: srcMediaId });
      setPlayItem(srcMediaId);
    } else if (playbackMode === 'native') {
      durationChangeNative();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcMediaId]);

  useEffect(() => {
    return () => {
      if (typeof URL.revokeObjectURL !== 'function') return;
      if (mediaState.url && mediaState.url.startsWith('blob:')) {
        URL.revokeObjectURL(mediaState.url);
      }
      if (blobState.url && blobState.url.startsWith('blob:')) {
        URL.revokeObjectURL(blobState.url);
      }
    };
  }, [mediaState.url, blobState.url]);

  useEffect(() => {
    if (mediaState.id !== srcMediaId && mediaState.remoteId !== srcMediaId)
      return;
    if (mediaState.status === MediaSt.FETCHED && playbackMode === 'pending') {
      const contentType = getMediaContentType(srcMediaId);
      if (
        shouldUseWaveSurferPlayback({
          url: mediaState.url,
          contentType,
        })
      ) {
        switchToWaveSurfer();
      } else {
        setPlaybackMode('native');
        setReady(true);
      }
    }
    if (mediaState.error) {
      if (mediaState.error.startsWith('no offline file'))
        showMessage(ts.fileNotFound);
      else showMessage(mediaState.error);
      onEnded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState, playbackMode, srcMediaId]);

  useEffect(() => {
    if (playbackMode !== 'wavesurfer') return;
    if (blobState.blobStat === BlobStatus.FETCHED) {
      if (!ready) setReady(true);
    }
    if (blobState.blobStat === BlobStatus.ERROR) {
      showMessage(ts.mediaError);
      onEnded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobState, playbackMode]);

  useEffect(() => {
    stopPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playItem]);

  useEffect(() => {
    if (!ready || playItem === '') return;
    if (playbackMode === 'native') {
      if (requestPlay) startPlayNative();
      else if (playingRef.current) {
        if (audioRef.current && playSuccess.current) audioRef.current.pause();
        stopPlay();
      }
    } else if (playbackMode === 'wavesurfer') {
      if (requestPlay) startPlayWaveSurfer();
      else stopPlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestPlay, playing, playItem, playbackMode]);

  const setPosition = (position: number | undefined) => {
    if (position === undefined) return;
    if (playbackMode === 'wavesurfer') {
      if (position !== currentTime) {
        setCurrentTime(position);
        setStartPos(position);
      }
      return;
    }
    if (audioRef.current && position !== audioRef.current.currentTime) {
      audioRef.current.currentTime = position;
    }
  };

  const ended = () => {
    if (playbackMode === 'native' && audioRef.current) {
      audioRef.current.currentTime = 0;
    } else if (playbackMode === 'wavesurfer') {
      resetWaveSurferTiming();
    }
    stopPlay();
    if (onEnded) onEnded();
  };

  const pause = () => {
    toggle(false);
  };
  const play = () => {
    toggle(true);
  };
  const toggle = (play: boolean) => {
    if (play !== playingRef.current && onTogglePlay) onTogglePlay();
  };

  const durationChangeNative = () => {
    const el = audioRef.current as HTMLMediaElement;
    if (!durationSet.current && el?.duration) {
      durationSet.current = true;
      onLoaded && onLoaded();
    }
  };

  const durationChangeWaveSurfer = (duration: number) => {
    if (durationRef.current === 0 && duration) {
      stop.current = duration;
      durationRef.current = duration;
      if (!durationSet.current) {
        durationSet.current = true;
        onLoaded && onLoaded();
      }
    }
  };

  const handleError = (e: any) => {
    logError(Severity.error, reporter, e);
    const mediaError = e?.target?.error;
    if (mediaError) {
      logError(
        Severity.error,
        reporter,
        `MediaError code: ${mediaError.code} message: ${mediaError.message ?? ''}`
      );
    }
    if (!nativeErrorHandled.current) {
      nativeErrorHandled.current = true;
      switchToWaveSurfer();
      return;
    }
    showMessage(ts.mediaError);
    onEnded();
  };

  const handleSegmentStart = () => {
    setPosition(0);
  };

  const handleSkipBack = () => {
    if (playbackMode === 'wavesurfer') {
      setPosition(Math.max(currentTime - 3, 0));
      return;
    }
    if (audioRef.current)
      setPosition(Math.max(audioRef.current?.currentTime - 3, 0));
  };

  const handlePlayPause = () => {
    if (onTogglePlay) onTogglePlay();
    if (playingRef.current) stopPlay();
    else startPlayWaveSurfer();
  };

  const startPlayNative = () => {
    if (playing || playSuccess.current) return;
    setPlaying(true);
    playSuccess.current = false;
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            if (audioRef.current) playSuccess.current = true;
          })
          .catch(() => {
            playSuccess.current = false;
          });
      }
    }
  };

  const startPlayWaveSurfer = () => {
    if (playingRef.current) return;
    setPlaying(true);
  };

  const stopPlay = () => {
    setPlaying(false);
    playSuccess.current = false;
  };

  const timeUpdate = (progress: number) => {
    const time = Math.round(progress * 1000) / 1000;
    if (stop.current !== 0 && time >= stop.current) {
      ended();
    } else if (
      durationRef.current - time < 0.1 &&
      durationRef.current - valueTracker.current < 0.1 &&
      valueTracker.current !== 0
    ) {
      ended();
    } else if (playingRef.current && valueTracker.current !== time) {
      valueTracker.current = time;
      setCurrentTime(time);
    }
  };

  return ready ? (
    <StyledStack direction="row" sx={{ ...sx }}>
      {controls && (
        <>
          <StyledTip title={t.resourceStart}>
            <IconButton
              data-testid="segment-start"
              sx={{ p: 0 }}
              onClick={handleSegmentStart}
            >
              <SkipPrevious fontSize="small" />
            </IconButton>
          </StyledTip>
          <StyledTip title={t.back3Seconds}>
            <IconButton
              data-testid="skip-back"
              sx={{ p: 0, pl: 1 }}
              onClick={handleSkipBack}
            >
              <ReplayIcon fontSize="small" />
            </IconButton>
          </StyledTip>
        </>
      )}
      {controls && playbackMode === 'wavesurfer' && (
        <IconButton
          data-testid="play-pause"
          sx={{ p: 0, pl: 1 }}
          onClick={handlePlayPause}
        >
          {playing ? (
            <Pause fontSize="small" />
          ) : (
            <PlayArrow fontSize="small" />
          )}
        </IconButton>
      )}
      {playbackMode === 'native' && (
        <audio
          controls={controls}
          onEnded={ended}
          ref={audioRef}
          src={mediaState.url}
          onDurationChange={durationChangeNative}
          onError={handleError}
          onPause={pause}
          onPlay={play}
        />
      )}
      {controls && props.onCancel && (
        <StyledTip title={ts.close}>
          <IconButton onClick={props.onCancel} sx={{ p: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </StyledTip>
      )}
      {playbackMode === 'wavesurfer' && (
        <StyledHidden>
          <HiddenPlayer
            onProgress={timeUpdate}
            onDuration={durationChangeWaveSurfer}
            position={startPos}
            loading={blobState.blobStat === BlobStatus.PENDING}
            audioBlob={blobState.blob}
            playing={playing}
            setPlaying={setPlaying}
          />
        </StyledHidden>
      )}
    </StyledStack>
  ) : (
    <></>
  );
}
export default MediaPlayer;
