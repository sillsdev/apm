import * as React from 'react';
import { ActionRow, Button, rowSx } from '../../control';
import { styled, Box, BoxProps, Divider, Typography } from '@mui/material';
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
  explicitAsrMethod,
  isoFromBcp47,
  needsSisterLanguage,
} from './asrLanguages';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { logError, Severity } from '../../utils';
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
   * cancel=true dismisses; otherwise returns the ASR settings for this run.
   * The choice is not saved; admins save a team default with its own button.
   */
  onClose: (cancel: boolean, asrState?: IAsrState) => void;
  /**
   * ASR driven by a workflow step's own language (e.g. LWC translation) rather
   * than the org/project vernacular. Seeds the dialog from the step and decides
   * the sister language against the step language. Saving writes that step, not
   * the org default.
   */
  stepAsr?: { primaryBcp47: string; asr: IAsrState };
}

const emptyAsrLanguage = {
  bcp47: 'und',
  languageName: '',
  font: 'charissil',
  rtl: false,
  spellCheck: false,
};

export default function SelectAsrLanguage({
  team,
  onClose,
  stepAsr,
}: Readonly<ISelectAsrLanguage>) {
  const [asrState, setAsrState] = React.useState<IAsrState>();
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [errorReporter] = useGlobal('errorReporter');
  const [vernacularBcp47, setVernacularBcp47] = React.useState('und');
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const {
    getAsrSettings,
    getVernacularLanguage,
    getCachedSisterRecommendations,
    getCachedStepSisterRecommendations,
    saveSisterRecommendations,
    saveStepSisterRecommendations,
    canSetOrgDefault,
    canSetTeamAsrDefault,
    saveTeamAsrSettings,
    saveStepAsrSettings,
  } = useGetAsrSettings(team);
  const { suggestions, loading, error, fetchRecommendations, seedSuggestions } =
    useRecommendAsrLanguage();
  const checkOnline = useCheckOnline(t.run);
  const { showMessage } = useSnackBar();
  const showTeamDefault = stepAsr ? canSetOrgDefault : canSetTeamAsrDefault();
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;

  const handleRun = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      onClose(false, asrState);
    });
  };

  const handleSaveTeamDefault = () => {
    if (!asrState) return;
    if (stepAsr) saveStepAsrSettings(asrState);
    else saveTeamAsrSettings(asrState);
    showMessage(t.asrTeamDefaultSaved);
  };

  const settingsIncomplete =
    !asrState?.target ||
    (asrState?.target === AsrTarget.alphabet &&
      !isLangSet(asrState?.language?.bcp47));

  const reportLoadFailure = (err: unknown) => {
    logError(
      Severity.error,
      errorReporter,
      err instanceof Error ? err : new Error(String(err))
    );
    setLoadFailed(true);
  };

  const loadSisterSuggestions = (bcp47: string) => {
    if (stepAsr) {
      // This step's language is not the vernacular, so its recommendations
      // live on the step itself.
      const cached = getCachedStepSisterRecommendations();
      if (cached) {
        seedSuggestions(cached);
        return;
      }
      void fetchRecommendations(
        isoFromBcp47(bcp47),
        saveStepSisterRecommendations
      );
      return;
    }
    // Reuse the org-cached recommendations when the project matches the org;
    // only query the service when there's no usable cache (e.g. project differs).
    const cached = getCachedSisterRecommendations();
    if (cached) {
      seedSuggestions(cached);
      return;
    }
    // Persist results so a project whose language differs from the org only
    // queries the recommendation service once (saveSisterRecommendations is a
    // no-op when the project matches the org).
    void fetchRecommendations(isoFromBcp47(bcp47), saveSisterRecommendations);
  };

  const seedDialog = async (isCancelled: () => boolean) => {
    const asr = stepAsr ? stepAsr.asr : await getAsrSettings();
    if (isCancelled()) return;
    const bcp47 = stepAsr
      ? stepAsr.primaryBcp47
      : (getVernacularLanguage()?.bcp47 ?? 'und');
    // Still seed the dialog when the check fails, so the user can pick a language.
    let needsSister = false;
    try {
      needsSister = await needsSisterLanguage(bcp47, token);
    } catch (err: unknown) {
      if (!isCancelled()) reportLoadFailure(err);
    }
    if (isCancelled()) return;
    // A step without a sister resolves its ASR language to the primary itself,
    // which can't be transcribed; start the sister picker empty instead.
    const seedIsPrimary =
      needsSister && stepAsr && asr?.language?.bcp47 === bcp47;
    setAsrState({
      target: asr?.target ?? AsrTarget.alphabet,
      language: seedIsPrimary
        ? emptyAsrLanguage
        : (asr?.language ?? emptyAsrLanguage),
      asrIso: seedIsPrimary ? 'und' : (asr?.asrIso ?? 'eng'),
      asrMethod: explicitAsrMethod(asr?.asrMethod),
      dialect: asr?.dialect,
      selectRoman: asr?.selectRoman ?? false,
    } as IAsrState);
    setVernacularBcp47(bcp47);
    if (needsSister) loadSisterSuggestions(bcp47);
  };

  React.useEffect(() => {
    let cancelled = false;
    seedDialog(() => cancelled).catch((err: unknown) => {
      if (!cancelled) reportLoadFailure(err);
    });
    return () => {
      cancelled = true;
    };
    // Mount once. Later token or settings-loader identity changes must not
    // reload the dialog over an edit already in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledBox sx={{ minWidth: 120 }}>
      {loadFailed && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {t.asrRequestFailed}
        </Typography>
      )}
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
      <Divider sx={{ pt: 2 }} />
      <ActionRow>
        <Box sx={rowSx}>
          <Button onClick={() => onClose(true)}>{ts.cancel}</Button>
          {showTeamDefault && (
            <Button
              disabled={settingsIncomplete}
              onClick={handleSaveTeamDefault}
            >
              {t.asrSaveTeamDefault}
            </Button>
          )}
          <Button
            color="primary"
            disabled={settingsIncomplete}
            onClick={handleRun}
          >
            {t.run}
          </Button>
        </Box>
      </ActionRow>
    </StyledBox>
  );
}
