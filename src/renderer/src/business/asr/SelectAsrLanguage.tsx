import * as React from 'react';
import { ActionRow, AltButton, PriButton } from '../../control';
import {
  styled,
  Box,
  BoxProps,
  Divider,
  Stack,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Badge,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  ISharedStrings,
  ITranscriberStrings,
  OrganizationD,
} from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector, transcriberSelector } from '../../selector';
import { AsrAlphabet, IAsrState } from './AsrAlphabet';
import { getPreferredAsrMethod } from './asrLanguages';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { useCheckOnline } from '../../utils/useCheckOnline';
import { useSnackBar } from '../../hoc/SnackBar';
import { AsrTarget } from './AsrTarget';

const StyledBox = styled(Box)<BoxProps>(() => ({
  '& * > .MuiBox-root': {
    display: 'inline-flex',
    alignItems: 'center',
  },
}));

interface ISelectAsrLanguage {
  team?: OrganizationD;
  /** cancel=true dismisses; otherwise returns run-time ASR override (not persisted). */
  onClose: (cancel: boolean, asrState?: IAsrState) => void;
}

export default function SelectAsrLanguage({
  team,
  onClose,
}: ISelectAsrLanguage) {
  const [asrState, setAsrState] = React.useState<IAsrState>();
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { getAsrSettings } = useGetAsrSettings(team);
  const checkOnline = useCheckOnline(t.run);
  const { showMessage } = useSnackBar();

  const handleTargetChange = (_e: unknown, value: string) => {
    if (asrState) setAsrState({ ...asrState, target: value as AsrTarget });
  };

  const handleRun = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      onClose(false, asrState);
    });
  };

  React.useEffect(() => {
    const asr = getAsrSettings();
    setAsrState({
      target: asr?.target ?? AsrTarget.alphabet,
      language: asr?.language ?? {
        bcp47: 'und',
        languageName: '',
        font: 'charissil',
        rtl: false,
        spellCheck: false,
      },
      mmsIso: asr?.mmsIso ?? 'eng',
      method:
        asr?.method ?? getPreferredAsrMethod(asr?.mmsIso ?? 'eng') ?? 'whisper',
      dialect: asr?.dialect,
      selectRoman: asr?.selectRoman ?? false,
    } as IAsrState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledBox sx={{ minWidth: 120 }}>
      <Stack>
        <AsrAlphabet
          state={asrState ?? ({} as IAsrState)}
          setState={setAsrState}
        />
        <FormControl sx={{ ml: 2 }}>
          <RadioGroup
            value={asrState?.target ?? AsrTarget.alphabet}
            onChange={handleTargetChange}
          >
            <FormControlLabel
              value={AsrTarget.alphabet}
              control={<Radio />}
              label={t.scriptTranscription}
            />
            <FormControlLabel
              value={AsrTarget.phonetic}
              control={<Radio />}
              label={
                <Badge
                  badgeContent={<InfoIcon color={'info'} fontSize="small" />}
                  title={t.phoneticTip}
                >
                  {t.phonetic}
                </Badge>
              }
            />
          </RadioGroup>
        </FormControl>
      </Stack>
      <Divider sx={{ pt: 2 }} />
      <ActionRow>
        <AltButton onClick={() => onClose(true)}>{ts.cancel}</AltButton>
        <PriButton
          onClick={handleRun}
          disabled={
            !asrState?.target ||
            (asrState?.target === AsrTarget.alphabet &&
              (asrState?.language?.bcp47 === undefined ||
                asrState?.language?.bcp47 === 'und'))
          }
        >
          {t.run}
        </PriButton>
      </ActionRow>
    </StyledBox>
  );
}
