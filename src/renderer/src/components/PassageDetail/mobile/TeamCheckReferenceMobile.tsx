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
import { PassageDetailChooser } from '../PassageDetailChooser';
import { IRegion, ToolSlug, useStepTool } from '../../../crud';
import { PassageDetailPlayerMobile } from './PassageDetailPlayerMobile';
import PassageDetailPlayer from '../PassageDetailPlayer';
import { BlobStatus, useFetchMediaBlob } from '../../../crud/useFetchMediaBlob';
import { IMarker } from 'crud/useWaveSurfer';

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
  display: 'flex', // ← Add this
  width: '80%', // ← Add this
  alignItems: 'center', // ← Add this
  margin: '0 auto',
  justifyContent: 'center',
  alignContent: 'center',
}));

export function TeamCheckReferenceMobile() {
  const ctx = useContext(PassageDetailContext);

  const {
    rowData,
    setPlayItem,
    setMediaSelected,
    section,
    passage,
    currentstep,
  } = ctx.state;

  const [loading] = useState(false);
  const [pdBusy, setPDBusy] = useState(false);
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const [playing, setPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<
    number | undefined
  >(undefined);
  const [discussionMarkers] = useState<IMarker[]>([]);
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const playerMediafile = useMemo(
    () => rowData.find((r) => r.id === mediaId)?.mediafile,
    [mediaId, rowData]
  );
  const forceRefresh = () => {
    console.log('forceRefresh called');
  };
  const setupLocate = () => {
    console.log('setupLocate called');
  };
  const setCurrentSegment = (region: IRegion | undefined, index: number) => {
    console.log('setCurrentSegment called with index', index);
    setCurrentSegmentIndex(index);
  };

  const [resource, setResource] = useState('');
  const { removeStoredKeys, saveKey, storeKey, SecSlug } = storedCompareKey(
    passage,
    section
  );

  const handleHighlightDiscussion = (time: number) => {
    console.log('handleHighlightDiscussion called with time', time);
  };

  useEffect(() => {
    console.log('mediafileId changed:', ctx.state.mediafileId);
    console.log('ta dataaaaaaaaaaaa: ', resource);
    console.log(
      'ta data: ',
      rowData.find((r) => r.id === resource)
    );
  }, [ctx.state.mediafileId, resource, rowData]);

  const handleResource = (id: string) => {
    const row = rowData.find((r) => r.id === id);
    console.log('handleResource', id, row);
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
    // We track the user's choices for each passage of the section
    const res = localStorage.getItem(storeKey());
    const secId = localStorage.getItem(storeKey(SecSlug));
    if (res && secId === section.id) {
      setResource(res);
      handleResource(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, passage, currentstep]);

  //const [paneWidth, setPaneWidth] = useState(0);
  const paneWidth = 100;
  const tool = useStepTool(currentstep).tool;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerWidth, setPlayerWidth] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      setPlayerWidth(containerRef.current!.offsetWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);
  //const currentstep = ctx.state.currentstep;

  return (
    <MobileGrid container direction="column">
      <MobileGrid>
        <StyledGrid ref={containerRef} size={{ xs: 12 }}>
          <PassageDetailChooser width={paneWidth} />
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayer
              width={Math.max(playerWidth)}
              allowZoomAndSpeed={true}
            />
          )}
        </StyledGrid>
      </MobileGrid>

      <MobileGrid>
        <SelectMyResource onChange={handleResource} inResource={resource} />
      </MobileGrid>

      <MobileGrid>
        <StyledGrid size={{ xs: 12 }}>
          <PassageDetailChooser width={paneWidth} />
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayerMobile
              width={Math.round(playerWidth)}
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
                handleHighlightDiscussion,
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
