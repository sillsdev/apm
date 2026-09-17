import * as React from 'react';
import { Button, columnSx, rowSx, spreadSx } from '../../control';
import { Box } from '@mui/material';
import {
  ISharedStrings,
  ITranscriberStrings,
  OrganizationD,
} from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector, transcriberSelector } from '../../selector';
import { AsrSettings } from './AsrSettings';
import { asrStatesEqual, IAsrState } from './asrState';
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

interface ISelectAsrLanguage {
  team?: OrganizationD;
  /**
   * cancel=true dismisses; otherwise returns the run-time ASR override.
   * isTeamDefault says the returned settings are the org (team) default —
   * either already saved there or just saved from this dialog — so the caller
   * must not also write them as the project default, which would shadow it.
   */
  onClose: (
    cancel: boolean,
    asrState?: IAsrState,
    isTeamDefault?: boolean
  ) => void;
}

export default function SelectAsrLanguage({
  team,
  onClose,
}: ISelectAsrLanguage) {
  const [asrState, setAsrState] = React.useState<IAsrState>();
  const [vernacularBcp47, setVernacularBcp47] = React.useState('und');
  // The settings currently saved as the team default (seeded from the org on
  // mount), so the button is enabled only while the settings differ from them.
  const [teamDefaultAsr, setTeamDefaultAsr] = React.useState<IAsrState>();
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const {
    getAsrSettings,
    getVernacularLanguage,
    getCachedSisterRecommendations,
    saveSisterRecommendations,
    canSetTeamAsrDefault,
    getTeamAsrSettings,
    saveTeamAsrSettings,
  } = useGetAsrSettings(team);
  const { suggestions, loading, error, fetchRecommendations, seedSuggestions } =
    useRecommendAsrLanguage();
  const checkOnline = useCheckOnline(t.run);
  const { showMessage } = useSnackBar();
  const showTeamDefault = canSetTeamAsrDefault();
  const incomplete =
    !asrState?.target ||
    (asrState?.target === AsrTarget.alphabet &&
      !isLangSet(asrState?.language?.bcp47));
  const teamDefaultSaved = asrStatesEqual(teamDefaultAsr, asrState);

  /** Persist the current settings as the team default without closing. */
  const handleTeamDefault = () => {
    if (!asrState) return;
    saveTeamAsrSettings(asrState);
    setTeamDefaultAsr(asrState);
  };

  const handleRun = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      onClose(false, asrState, showTeamDefault && teamDefaultSaved);
    });
  };

  React.useEffect(() => {
    const asr = getAsrSettings();
    setTeamDefaultAsr(getTeamAsrSettings());
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
    <Box sx={columnSx}>
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
      <Box sx={spreadSx}>
        <Box sx={rowSx}>
          {showTeamDefault && (
            <Button
              disabled={incomplete || teamDefaultSaved}
              onClick={handleTeamDefault}
            >
              {ts.teamDefault}
            </Button>
          )}
        </Box>
        <Box sx={rowSx}>
          <Button onClick={() => onClose(true)}>{ts.cancel}</Button>
          <Button color="primary" disabled={incomplete} onClick={handleRun}>
            {t.run}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
