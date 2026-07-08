import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { PassageDetailPlayer } from '../PassageDetailPlayer';
import { BlobStatus, useFetchMediaBlob } from '../../../crud/useFetchMediaBlob';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { promptSelector, workflowStepsSelector } from '../../../selector';
import { IWorkflowStepsStrings, IPromptStrings } from '../../../model';
import { usePromptSectionResource } from './usePromptSectionResource';

interface IProps {
  width: number;
}

export default function PassageDetailPromptMember(props: IProps) {
  const { width } = props;
  const {
    rowData,
    section,
    currentstep,
    setPromptPlaybackComplete,
    setStepComplete,
    isBoldWorkflow,
  } = usePassageDetailContext();
  const { promptMediaId, hasPrompt } = usePromptSectionResource(
    rowData,
    section,
    currentstep
  );
  const wf: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const t: IPromptStrings = useSelector(promptSelector, shallowEqual);
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const loading = false;
  const [pdBusy, setPDBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const durationRef = useRef(0);
  const playbackCompleteRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerWidth, setPlayerWidth] = useState(width);

  const playerMediafile = useMemo(
    () => rowData.find((r) => r.id === promptMediaId)?.mediafile,
    [promptMediaId, rowData]
  );

  useEffect(() => {
    playbackCompleteRef.current = false;
    setPromptPlaybackComplete(false);
    durationRef.current = 0;
  }, [section.id, currentstep, promptMediaId, setPromptPlaybackComplete]);

  useEffect(() => {
    if (promptMediaId) {
      fetchBlob(promptMediaId);
    }
  }, [promptMediaId, fetchBlob]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      setPlayerWidth(containerRef.current!.offsetWidth);
    };
    updateWidth();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateWidth);
      observer.observe(containerRef.current);
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const dur = playerMediafile?.attributes?.duration;
    if (dur) durationRef.current = dur;
  }, [playerMediafile]);

  const handleDuration = (duration: number) => {
    if (duration > 0) durationRef.current = duration;
  };

  const handleProgress = (progress: number) => {
    const dur = durationRef.current;
    if (!playbackCompleteRef.current && dur > 0.1 && progress >= dur - 0.1) {
      playbackCompleteRef.current = true;
      setPromptPlaybackComplete(true);
      if (isBoldWorkflow) {
        setStepComplete(currentstep, true);
      }
    }
  };

  if (!hasPrompt) {
    return (
      <Box sx={{ width: '100%', py: 4, px: 2 }}>
        <Typography variant="h3" align="center">
          {t.noAudio}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box ref={containerRef} sx={{ width: '100%', minWidth: 0 }}>
        <PassageDetailPlayer
          width={Math.max(0, playerWidth)}
          allowZoom={true}
          allowSpeed={false}
          onDuration={handleDuration}
          onProgress={handleProgress}
          playerState={{
            loading,
            pdBusy,
            setPDBusy,
            audioBlob:
              blobState.blobStat === BlobStatus.FETCHED
                ? blobState.blob
                : undefined,
            setupLocate: () => {},
            playing,
            setPlaying,
            currentstep,
            playerMediafile,
            forceRefresh: () => {},
          }}
        />
      </Box>
      <Typography variant="body1" align="center" sx={{ mt: 3, px: 2 }}>
        {wf.promptTip}
      </Typography>
    </Box>
  );
}
