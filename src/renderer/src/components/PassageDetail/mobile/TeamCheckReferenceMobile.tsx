import { useContext, useEffect, useState } from 'react';
import { Grid, GridProps, styled } from '@mui/material';
import SelectMyResource from '../Internalization/SelectMyResource';
import { LimitedMediaPlayer } from '../../LimitedMediaPlayer';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { getSegments, NamedRegions } from '../../../utils';
import { storedCompareKey } from '../../../utils/storedCompareKey';

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
  margin: '0 auto',
  justifyContent: 'center',
  alignItems: 'center',
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

  return (
    <MobileGrid
      sx={{
        m: '10%',
        p: '2px',
        display: 'flex', // ← Add this
        width: '90%', // ← Add this
        alignItems: 'center', // ← Add this
      }}
      container
      direction="column"
    >
      <MobileGrid
        sx={{
          m: '10%',
          p: '2px',
          display: 'flex', // ← Add this
          width: '90%', // ← Add this
          alignItems: 'center', // ← Add this
        }}
      >
        <SelectMyResource onChange={handleResource} inResource={resource} />
      </MobileGrid>
      <StyledGrid size={{ xs: 10 }}>
        <LimitedMediaPlayer
          srcMediaId={playItem}
          requestPlay={itemPlaying}
          onTogglePlay={handleItemTogglePlay}
          onEnded={handleEnded}
          noClose={true}
          controls={true}
          limits={{ start: mediaStart, end: mediaEnd }}
        />
      </StyledGrid>
    </MobileGrid>
  );
}

export default TeamCheckReferenceMobile;
