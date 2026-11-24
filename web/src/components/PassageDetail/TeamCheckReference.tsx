import { useContext, useEffect, useState } from 'react';
import { Grid, GridProps, styled } from '@mui/material';
import SelectMyResource from './Internalization/SelectMyResource';
import { MinimalAudioPlayer } from '../MinimalAudioPlayer';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import type { TimeRange } from '../../control/formatTime';
import { resourceClip } from './Internalization/resourceClip';
import { storedCompareKey } from '../../utils/storedCompareKey';
import { useCompareReferenceText } from './Internalization/useCompareReferenceText';
import { CompareReferenceText } from './Internalization/CompareReferenceText';

const StyledGrid = styled(Grid)<GridProps>(({ theme }) => ({
  margin: theme.spacing(2),
  paddingRight: theme.spacing(2),
  width: '100%',
  '& audio': {
    display: 'flex',
    width: 'inherit',
    marginRight: theme.spacing(2),
  },
}));

export function TeamCheckReference() {
  const ctx = useContext(PassageDetailContext);
  const { rowData, section, passage, currentstep } = ctx.state;
  const [playId, setPlayId] = useState('');
  const [clip, setClip] = useState<TimeRange>();
  const [resource, setResource] = useState('');
  const { removeStoredKeys, saveKey, storeKey, SecSlug } = storedCompareKey(
    passage,
    section
  );
  const { referenceRank, selectReferenceText, clearReferenceText } =
    useCompareReferenceText({ removeStoredKeys, saveKey }, () => setPlayId(''));

  const handleResource = (id: string) => {
    if (selectReferenceText(id)) return;
    const row = rowData.find((r) => r.id === id);
    if (row) {
      removeStoredKeys();
      saveKey(id);
    }
    setClip(resourceClip(row?.mediafile));
    setPlayId(id);
  };

  useEffect(() => {
    setPlayId('');
    // Reset here, not with a key: this effect must run anyway to restore the
    // saved choice, and a key would remount the player on every passage
    // change. TT-7819
    clearReferenceText();
    // We track the user's choices for each passage of the section
    const res = localStorage.getItem(storeKey());
    const secId = localStorage.getItem(storeKey(SecSlug));
    if (res && secId === section.id) {
      setResource(res);
      handleResource(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, passage, currentstep]);

  return (
    <Grid container direction="column">
      <Grid size={{ xs: 10 }} sx={{ m: 2, p: 2 }}>
        <SelectMyResource onChange={handleResource} inResource={resource} />
      </Grid>
      <StyledGrid size={{ xs: 10 }}>
        {referenceRank ? (
          <CompareReferenceText key={passage.id} rank={referenceRank} />
        ) : (
          playId && <MinimalAudioPlayer srcMediaId={playId} clip={clip} />
        )}
      </StyledGrid>
    </Grid>
  );
}

export default TeamCheckReference;
