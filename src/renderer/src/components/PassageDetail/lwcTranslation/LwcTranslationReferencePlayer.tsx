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
  referenceMediaId: string | undefined;
  playKey: number;
  onPlaybackComplete: () => void;
  onPlayStatus?: (playing: boolean) => void;
}

export default function LwcTranslationReferencePlayer({
  width,
  referenceMediaId,
  playKey,
  onPlaybackComplete,
  onPlayStatus,
}: Props) {
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const mediaStateRef = useRef(mediaState);
  const ts = useSelector(sharedSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [loading, setLoading] = useState(false);
  const controlsRef = useRef<WSAudioPlayerControls | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const durationRef = useRef(0);
  const completedRef = useRef(false);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    mediaStateRef.current = mediaState;
  }, [mediaState]);

  useEffect(() => {
    durationRef.current = 0;
    completedRef.current = false;
    wasPlayingRef.current = false;
    pendingAutoPlayRef.current = playKey > 0;
  }, [referenceMediaId, playKey]);

  useEffect(() => {
    if (!referenceMediaId) {
      setAudioBlob(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadReference = async () => {
      setLoading(true);
      setAudioBlob(undefined);
      fetchMediaUrl({ id: referenceMediaId });

      try {
        await waitForIt(
          'lwc reference media url',
          () =>
            mediaStateRef.current.status === MediaSt.FETCHED &&
            mediaStateRef.current.id === referenceMediaId,
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
  }, [referenceMediaId]);

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
      if (wasPlayingRef.current && !playing) {
        maybeComplete(durationRef.current);
      }
      wasPlayingRef.current = playing;
    },
    [maybeComplete, onPlayStatus]
  );

  if (!referenceMediaId) return null;

  return (
    <Box sx={{ width: '100%' }} data-cy="lwc-reference-player">
      <WSAudioPlayer
        key={`${referenceMediaId}-${playKey}`}
        id="lwc-reference-player"
        blob={audioBlob}
        segments="{}"
        allowRecord={false}
        hideSegmentControls={true}
        hideWaveformEditTools={true}
        allowZoom={true}
        height={160}
        width={width - 16}
        loading={loading}
        controlsRef={controlsRef}
        onDuration={handleDuration}
        onProgress={maybeComplete}
        onPlayStatus={handlePlayStatus}
      />
    </Box>
  );
}
