import * as React from 'react';
import { ActionRow, AltButton, PriButton } from '../../control';
import {
  styled,
  Box,
  BoxProps,
  Checkbox,
  Divider,
  FormControlLabel,
} from '@mui/material';
import {
  ISharedStrings,
  ITranscriberStrings,
  OrganizationD,
} from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector, transcriberSelector } from '../../selector';
import { AsrSettings } from './AsrSettings';
import { IAsrState } from './asrState';
import {
  getPreferredAsrMethod,
  isoFromBcp47,
  needsSisterLanguage,
} from './asrLanguages';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { useRecommendAsrLanguage } from './useRecommendAsrLanguage';
import { useCheckOnline } from '../../utils/useCheckOnline';
import { isLangSet } from '../../utils/langTag';
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
  /**
   * cancel=true dismisses; otherwise returns the run-time ASR override.
   * setAsTeamDefault requests persisting the choice as the org (team) default
   * instead of the project default.
   */
  onClose: (
    cancel: boolean,
    asrState?: IAsrState,
    setAsTeamDefault?: boolean
  ) => void;
}

export default function SelectAsrLanguage({
  team,
  onClose,
}: ISelectAsrLanguage) {
  const [asrState, setAsrState] = React.useState<IAsrState>();
  const [vernacularBcp47, setVernacularBcp47] = React.useState('und');
  const [setAsTeamDefault, setSetAsTeamDefault] = React.useState(false);
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const {
    getAsrSettings,
    getVernacularLanguage,
    getCachedSisterRecommendations,
    saveSisterRecommendations,
    canSetTeamAsrDefault,
  } = useGetAsrSettings(team);
  const { suggestions, loading, error, fetchRecommendations, seedSuggestions } =
    useRecommendAsrLanguage();
  const checkOnline = useCheckOnline(t.run);
  const { showMessage } = useSnackBar();
  const showTeamDefault = canSetTeamAsrDefault();

  const handleRun = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      onClose(false, asrState, showTeamDefault && setAsTeamDefault);
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
      asrIso: asr?.asrIso ?? 'eng',
      method:
        asr?.method ?? getPreferredAsrMethod(asr?.asrIso ?? 'eng') ?? 'whisper',
      dialect: asr?.dialect,
      selectRoman: asr?.selectRoman ?? false,
    } as IAsrState);
    const vernacular = getVernacularLanguage();
    const bcp47 = vernacular?.bcp47 ?? 'und';
    setVernacularBcp47(bcp47);
    if (needsSisterLanguage(bcp47)) {
      // Reuse the org-cached recommendations when the project matches the org;
      // only query the service when there's no usable cache (e.g. project differs).
      const cached = getCachedSisterRecommendations();
      if (cached) seedSuggestions(cached);
      // Persist results so a project whose language differs from the org only
      // queries the recommendation service once (saveSisterRecommendations is a
      // no-op when the project matches the org).
      else fetchRecommendations(isoFromBcp47(bcp47), saveSisterRecommendations);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledBox sx={{ minWidth: 120 }}>
      {asrState && (
        <AsrSettings
          asr={asrState}
          setAsr={setAsrState}
          vernacularBcp47={vernacularBcp47}
          suggestions={suggestions}
          loading={loading}
          error={error}
        />
      )}
      {showTeamDefault && (
        <FormControlLabel
          sx={{ ml: 1 }}
          control={
            <Checkbox
              checked={setAsTeamDefault}
              onChange={(_e, checked) => setSetAsTeamDefault(checked)}
            />
          }
          label={ts.teamDefault}
        />
      )}
      <Divider sx={{ pt: 2 }} />
      <ActionRow>
        <AltButton onClick={() => onClose(true)}>{ts.cancel}</AltButton>
        <PriButton
          onClick={handleRun}
          disabled={
            !asrState?.target ||
            (asrState?.target === AsrTarget.alphabet &&
              !isLangSet(asrState?.language?.bcp47))
          }
        >
          {t.run}
        </PriButton>
      </ActionRow>
    </StyledBox>
  );
}
