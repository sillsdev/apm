import * as React from 'react';
import { Button, ActionRow, GrowingSpacer, rowSx } from '../../control';
import { Divider, Stack, TextField, Box } from '@mui/material';
import { ISharedStrings, Organization } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../../selector';
import { IVoicePerm } from './PersonalizeVoicePermission';
import { orgDefaultVoices, useOrgDefaults } from '../../crud';
import packageJson from '../../../package.json';
const owner = packageJson.author.name;

interface ISelectVoice {
  team?: Organization;
  refresh?: () => void;
  onOpen: () => void;
}

export default function SelectSponsor({ team, refresh, onOpen }: ISelectVoice) {
  const [permState, setPermState] = React.useState<IVoicePerm>({});
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const t: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  React.useEffect(() => {
    if (team) {
      const voices = getOrgDefault(orgDefaultVoices, team?.id) as IVoicePerm;
      if (voices) {
        setPermState(voices);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  const handleSave = () => {
    if (team) {
      setOrgDefault(orgDefaultVoices, permState, team?.id);
      refresh?.();
    }
    onOpen();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPermState((state) => ({
      ...state,
      [event.target.name]: event.target.value,
    }));
  };

  return (
    <Stack sx={{ minWidth: 120, pt: 2 }} spacing={2}>
      <TextField
        name="sponsor"
        label="Sponsor"
        variant="outlined"
        value={permState?.sponsor ?? owner}
        onChange={handleChange}
      />
      <Divider sx={{ pt: 2 }} />
      <ActionRow>
        <GrowingSpacer />
        <Box sx={rowSx}>
          <Button onClick={onOpen}>{t.cancel}</Button>
          <Button color="primary" onClick={handleSave}>
            {t.save}
          </Button>
        </Box>
      </ActionRow>
    </Stack>
  );
}
