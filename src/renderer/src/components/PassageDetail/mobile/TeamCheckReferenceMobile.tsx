import {
  useContext,
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
} from 'react';
import { Grid, GridProps, styled } from '@mui/material';
import SelectMyResource from '../Internalization/SelectMyResource';
import { LimitedMediaPlayer } from '../../LimitedMediaPlayer';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { getSegments, NamedRegions } from '../../../utils';
import { storedCompareKey } from '../../../utils/storedCompareKey';
import { PassageDetailChooser } from '../PassageDetailChooser';
import { ToolSlug, useStepTool } from '../../../crud';
import { PassageDetailPlayerMobile } from './PassageDetailPlayerMobile';

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
  m: '10%',
  p: '2px',
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
    playItem,
    setPlayItem,
    setMediaSelected,
    itemPlaying,
    handleItemPlayEnd,
    handleItemTogglePlay,
    section,
    passage,
    currentstep,
  } = ctx.state;

  const [mediaStart, setMediaStart] = useState<number | undefined>();
  const [mediaEnd, setMediaEnd] = useState<number | undefined>();
  const [resource, setResource] = useState('');
  const [resetCount, setResetCount] = useState(0);
  const { removeStoredKeys, saveKey, storeKey, SecSlug } = storedCompareKey(
    passage,
    section
  );

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
        setMediaStart(start);
        setMediaEnd(end);
        setMediaSelected(id, start, end);
        return;
      } else {
        setMediaStart(undefined);
        setMediaEnd(undefined);
      }
    }
    setPlayItem(id);
  };

  const handleEnded = () => {
    setPlayItem('');
    handleItemPlayEnd();
    setTimeout(() => setResetCount(resetCount + 1), 500);
  };

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
  }, [section, passage, currentstep, resetCount]);

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
        <StyledGrid ref={containerRef} id="Ryan2" size={{ xs: 12 }}>
          <PassageDetailChooser width={paneWidth} />
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayerMobile
              width={Math.round(playerWidth)}
              allowZoomAndSpeed={true}
            />
          )}
        </StyledGrid>
      </MobileGrid>

      <MobileGrid>
        <SelectMyResource onChange={handleResource} inResource={resource} />
      </MobileGrid>

      <MobileGrid>
        <StyledGrid ref={containerRef} id="Ryan2" size={{ xs: 12 }}>
          <PassageDetailChooser width={paneWidth} />
          {tool !== ToolSlug.KeyTerm && (
            <PassageDetailPlayerMobile
              width={Math.round(playerWidth)}
              allowZoomAndSpeed={true}
              mediaFileId={resource}
            />
          )}
        </StyledGrid>
      </MobileGrid>

      {/* <StyledGrid id="Ryan2" size={{ xs: 12 }}>
        <LimitedMediaPlayer
          srcMediaId={playItem}
          requestPlay={itemPlaying}
          onTogglePlay={handleItemTogglePlay}
          onEnded={handleEnded}
          noClose={true}
          controls={true}
          limits={{ start: mediaStart, end: mediaEnd }}
        />
      </StyledGrid> */}
    </MobileGrid>
  );
}

export default TeamCheckReferenceMobile;
