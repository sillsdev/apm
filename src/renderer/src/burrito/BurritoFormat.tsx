import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { useLocation, useParams } from 'react-router-dom';
import React from 'react';
import StickyRedirect from '../components/StickyRedirect';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { BurritoHeader } from '../components/BurritoHeader';
import { shallowEqual, useSelector } from 'react-redux';
import { burritoSelector } from '../selector';
import { IBurritoStrings } from '@model/index';
import {
  burritoFormat,
  BurritoFormatParams,
  BurritoTextOutputFormat,
  parseBurritoTextOutputFormat,
} from './burritoFormatParams';

export function BurritoFormat() {
  const { pathname } = useLocation();
  const { teamId } = useParams();
  const [view, setView] = React.useState('');
  const [convertToMp3, setConvertToMp3] = React.useState(false);
  const [textOutputFormat, setTextOutputFormat] =
    React.useState<BurritoTextOutputFormat>('usfm');
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);

  const handleSave = () => {
    setOrgDefault(
      burritoFormat,
      { convertToMp3, textOutputFormat } satisfies BurritoFormatParams,
      teamId
    );
    setView(`/burrito/${teamId}`);
  };

  React.useEffect(() => {
    if (!teamId) return;
    const raw = getOrgDefault(burritoFormat, teamId) as
      | BurritoFormatParams
      | undefined;
    setConvertToMp3(raw?.convertToMp3 === true);
    setTextOutputFormat(parseBurritoTextOutputFormat(raw?.textOutputFormat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return (
    <BurritoHeader
      burritoType={t.format}
      setView={setView}
      teamId={teamId}
      onSave={handleSave}
    >
      <Stack spacing={2} sx={{ minWidth: 240 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={convertToMp3}
              onChange={(_, checked) => setConvertToMp3(checked)}
            />
          }
          label={t.convertToMp3}
        />
        <FormControl size="small" fullWidth>
          <InputLabel id="burrito-text-output-format-label">
            {t.textOutputFormat}
          </InputLabel>
          <Select
            labelId="burrito-text-output-format-label"
            id="burrito-text-output-format"
            value={textOutputFormat}
            label={t.textOutputFormat}
            onChange={(e) =>
              setTextOutputFormat(e.target.value as BurritoTextOutputFormat)
            }
          >
            <MenuItem value="usfm">{t.textOutputUsfm}</MenuItem>
            <MenuItem value="usx">{t.textOutputUsx}</MenuItem>
            <MenuItem value="usj">{t.textOutputUsj}</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </BurritoHeader>
  );
}
