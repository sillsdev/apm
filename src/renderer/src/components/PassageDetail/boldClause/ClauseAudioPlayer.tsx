import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import WSAudioPlayer, { WSAudioPlayerControls } from '../../WSAudioPlayer';
import { useGlobal } from '../../../context/useGlobal';
import { MediaSt, useFetchMediaUrl } from '../../../crud';
import { loadBlobAsync, waitForIt } from '../../../utils';
import { useSnackBar } from '../../../hoc/SnackBar';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../../../selector';

interface Props {
  width: number;
  mediaId: string | undefined;
  playKey: number;
  onPlaybackComplete: () => void;
  onPlayStatus?: (playing: boolean) => void;
  playerId?: string;
  dataCy?: string;
  waitLabel?: string;
}

export default function ClauseAudioPlayer({
  width,
  mediaId,
  playKey,
  onPlaybackComplete,
  onPlayStatus,
  playerId = 'clause-audio-player',
  dataCy = 'clause-audio-player',
  waitLabel = 'clause audio media url',
}: Props) {
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const mediaStateRef = useRef(mediaState);
  const ts = useSelector(sharedSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [loading, setLoading] = useState(false);
  const controlsRef = useRef<WSAudioPlayerControls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width);
  const pendingAutoPlayRef = useRef(false);
  const durationRef = useRef(0);
  const completedRef = useRef(false);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    mediaStateRef.current = mediaState;
  }, [mediaState]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(el.clientWidth > 0 ? el.clientWidth : width);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  useEffect(() => {
    durationRef.current = 0;
    completedRef.current = false;
    wasPlayingRef.current = false;
    pendingAutoPlayRef.current = playKey > 0;
  }, [mediaId, playKey]);

  useEffect(() => {
    if (!mediaId) {
      setAudioBlob(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadReference = async () => {
      setLoading(true);
      setAudioBlob(undefined);
      fetchMediaUrl({ id: mediaId });

      try {
        await waitForIt(
          waitLabel,
          () =>
            mediaStateRef.current.status === MediaSt.FETCHED &&
            mediaStateRef.current.id === mediaId,
          () => mediaStateRef.current.status === MediaSt.ERROR,
          500
        );
      } catch {
        if (!cancelled) {
          showMessage(mediaStateRef.current.error || ts.mediaError);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const url = mediaStateRef.current.url;
      if (!url) {
        showMessage(ts.mediaError);
        setLoading(false);
        return;
      }

      try {
        const blob = await loadBlobAsync(url);
        if (cancelled) return;
        if (blob) {
          setAudioBlob(blob);
        } else {
          showMessage(ts.mediaError);
        }
      } catch {
        if (!cancelled) showMessage(ts.mediaError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReference();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  const maybeAutoPlay = useCallback(() => {
    if (
      !pendingAutoPlayRef.current ||
      !controlsRef.current?.isReady() ||
      durationRef.current <= 0
    ) {
      return;
    }
    pendingAutoPlayRef.current = false;
    controlsRef.current.setPlay(true);
  }, []);

  const maybeComplete = useCallback(
    (progress: number) => {
      if (completedRef.current) return;
      const duration = durationRef.current;
      if (duration > 0 && progress >= duration - 0.15) {
        completedRef.current = true;
        controlsRef.current?.setPlay(false);
        onPlaybackComplete();
      }
    },
    [onPlaybackComplete]
  );

  const handleDuration = useCallback(
    (duration: number) => {
      durationRef.current = duration;
      maybeAutoPlay();
    },
    [maybeAutoPlay]
  );

  const handlePlayStatus = useCallback(
    (playing: boolean) => {
      onPlayStatus?.(playing);
      wasPlayingRef.current = playing;
    },
    [onPlayStatus]
  );

  if (!mediaId) return null;

  const playerWidth = Math.max(0, containerWidth - 16);

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}
      data-cy={dataCy}
    >
      <WSAudioPlayer
        key={`${mediaId}-${playKey}`}
        id={playerId}
        blob={audioBlob}
        segments="{}"
        allowRecord={false}
        hideWaveformEditTools={true}
        allowZoom={true}
        height={160}
        width={playerWidth}
        loading={loading}
        controlsRef={controlsRef}
        onDuration={handleDuration}
        onProgress={maybeComplete}
        onPlayStatus={handlePlayStatus}
      />
    </Box>
  );
}
