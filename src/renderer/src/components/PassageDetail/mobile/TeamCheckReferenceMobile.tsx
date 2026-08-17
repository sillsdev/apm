import {
  useContext,
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Grid, GridProps, styled } from '@mui/material';
import SelectMyResource from '../Internalization/SelectMyResource';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { getSegments, NamedRegions } from '../../../utils';
import { storedCompareKey } from '../../../utils/storedCompareKey';
import { IRegion, ToolSlug, useStepTool } from '../../../crud';
import { PassageDetailPlayer } from '../PassageDetailPlayer';
import { BlobStatus, useFetchMediaBlob } from '../../../crud/useFetchMediaBlob';
import { IMarker } from '../../../crud/useWaveSurfer';

const StyledGrid = styled(Grid)<GridProps>(({ theme }) => ({
  margin: theme.spacing(2),
  paddingRight: theme.spacing(2),
  width: '100%',
  '& audio': {
    display: 'flex',
    width: 'inherit',
    marginRight: theme.spacing(2),
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
  },
}));

const MobileGrid = styled(Grid)<GridProps>(() => ({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  margin: '0 auto',
  justifyContent: 'center',
  alignContent: 'center',
}));

interface IProps {
  width?: number;
}

export function TeamCheckReferenceMobile(props: IProps) {
  const { width = 0 } = props;
  const ctx = useContext(PassageDetailContext);

  const {
    rowData,
    setPlayItem,
    setMediaSelected,
    playing: topPlaying,
    setPlaying: setTopPlaying,
    section,
    passage,
    currentstep,
  } = ctx.state;

  const [loading] = useState(false);
  const [pdBusy, setPDBusy] = useState(false);
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const [playing, setPlayingRaw] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<
    number | undefined
  >(undefined);
  const [discussionMarkers] = useState<IMarker[]>([]);
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const playerMediafile = useMemo(
    () => rowData.find((r) => r.id === mediaId)?.mediafile,
    [mediaId, rowData]
  );
  const forceRefresh = () => {};
  const setupLocate = () => {};
  const setCurrentSegment = (_region: IRegion | undefined, index: number) => {
    setCurrentSegmentIndex(index);
  };

  const [resource, setResource] = useState('');
  const { removeStoredKeys, saveKey, storeKey, SecSlug } = storedCompareKey(
    passage,
    section
  );

  // Mutual exclusion with the top (vernacular) player.
  const setPlaying = (play: boolean) => {
    if (play) setTopPlaying(false);
    setPlayingRaw(play);
  };

  useEffect(() => {
    if (topPlaying && playing) setPlayingRaw(false);
  }, [topPlaying, playing]);

  const handleResource = (id: string) => {
    const row = rowData.find((r) => r.id === id);
    if (row) {
      removeStoredKeys();
      saveKey(id);

      const segs = getSegments(
        NamedRegions.ProjectResource,
        row.mediafile.attributes.segments
      );
      const regions = JSON.parse(segs);
      if (regions.length > 0) {
        const { start, end } = regions[0];
        setMediaSelected(id, start, end);
        setMediaId(id);
        return;
      }
    }
    setMediaId(id);
  };

  useEffect(() => {
    if (mediaId) {
      fetchBlob(mediaId);
    }
  }, [mediaId, fetchBlob]);

  useEffect(() => {
    setPlayItem('');
    const res = localStorage.getItem(storeKey());
    const secId = localStorage.getItem(storeKey(SecSlug));
    if (res && secId === section.id) {
      setResource(res);
      handleResource(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, passage, currentstep]);

  const tool = useStepTool(currentstep).tool;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerWidth, setPlayerWidth] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      setPlayerWidth(containerRef.current!.offsetWidth);
    };
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      updateWidth();
      observer = new ResizeObserver(updateWidth);
      observer?.observe(containerRef.current as Element);
    }
    return () => observer?.disconnect();
  }, [containerRef]);

  return (
    <MobileGrid container direction="column">
      <MobileGrid>
        <StyledGrid ref={containerRef} size={{ xs: 12 }}>
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayer
              width={Math.max(playerWidth, width)}
              allowZoomAndSpeed={true}
            />
          )}
        </StyledGrid>
      </MobileGrid>

      <MobileGrid maxWidth={800} sx={{ width: '80%' }}>
        <SelectMyResource onChange={handleResource} inResource={resource} />
      </MobileGrid>

      <MobileGrid>
        <StyledGrid size={{ xs: 12 }}>
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayer
              width={Math.round(Math.max(playerWidth, width))}
              allowZoomAndSpeed={true}
              playerState={{
                loading,
                pdBusy,
                setPDBusy,
                audioBlob:
                  blobState.blobStat === BlobStatus.FETCHED
                    ? blobState.blob
                    : undefined,
                setupLocate,
                playing,
                setPlaying,
                currentstep,
                currentSegmentIndex,
                setCurrentSegment,
                discussionMarkers,
                playerMediafile,
                forceRefresh,
              }}
            />
          )}
        </StyledGrid>
      </MobileGrid>
    </MobileGrid>
  );
}

export default TeamCheckReferenceMobile;
