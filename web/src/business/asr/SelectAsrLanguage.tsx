import * as React from 'react';
import { ActionRow, Button, rowSx } from '../../control';
import {
  styled,
  Box,
  BoxProps,
  Divider,
  LinearProgress,
  Typography,
} from '@mui/material';
import {
  ISharedStrings,
  ITranscriberStrings,
  OrganizationD,
} from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector, transcriberSelector } from '../../selector';
import { AsrSettings } from './AsrSettings';
import { IAsrState, withoutPrimaryAsAsrLanguage } from './asrState';
import { initLang } from '../../control/initLang';
import { explicitAsrMethod, listedAsrMethod } from './asrMethod';
import { getMethodsForAsr, isoFromBcp47 } from './asrLanguages';
import { useNeedsSisterLanguage } from './useNeedsSisterLanguage';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { logError, Severity } from '../../utils';
import { toError } from '../../utils/toError';
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
   * Run saves the choice only for a project whose language differs from the
   * team's; admins save a team default with its own button.
   */
  onClose: (cancel: boolean, asrState?: IAsrState) => void;
  /**
   * ASR driven by a workflow step's own language (e.g. LWC translation) rather
   * than the org/project vernacular. Seeds the dialog from the step and decides
   * the sister language against the step language. Saving writes that step, not
   * the org default.
   */
  stepAsr?: {
    primaryBcp47: string;
    asr: IAsrState;
    /** The step these settings are read from, and so saved to. */
    stepId?: string;
  };
}

/** Progress while the dialog loads, or why it can't. */
function SeedingStatus({ message }: Readonly<{ message?: string }>) {
  if (!message) return <LinearProgress />;
  return (
    <Typography variant="body2" color="error" sx={{ mb: 1 }}>
      {message}
    </Typography>
  );
}

export default function SelectAsrLanguage({
  team,
  onClose,
  stepAsr,
}: Readonly<ISelectAsrLanguage>) {
  const [asrState, setAsrState] = React.useState<IAsrState>();
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [errorReporter] = useGlobal('errorReporter');
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
    saveProjectAsrSettings,
    saveStepAsrSettings,
  } = useGetAsrSettings(team);
  const { suggestions, loading, error, fetchRecommendations, seedSuggestions } =
    useRecommendAsrLanguage();
  const checkOnline = useCheckOnline(t.run);
  const { showMessage } = useSnackBar();
  // A step-language choice saves to the step it is read from; with none found
  // there is nowhere to save it.
  const showTeamDefault = stepAsr
    ? canSetOrgDefault && Boolean(stepAsr.stepId)
    : canSetTeamAsrDefault();
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;

  // The language being transcribed: the step's own, or the project's (else the
  // team's) vernacular.
  const primaryBcp47 = stepAsr
    ? stepAsr.primaryBcp47
    : (getVernacularLanguage()?.bcp47 ?? 'und');
  const { needsSister, failed: sisterCheckFailed } = useNeedsSisterLanguage(
    primaryBcp47,
    { onFailed: () => setLoadFailed(true) }
  );
  // Seed once the service has answered; a failed check still seeds, so the
  // user can pick a language.
  const sisterKnown = needsSister !== undefined || sisterCheckFailed;

  /**
   * The dialog's settings as they are run or saved: never the primary as the
   * ASR language when a sister is needed (see withoutPrimaryAsAsrLanguage),
   * and without a method the service no longer offers as a choice (see
   * listedAsrMethod). Applied when the user runs or saves.
   */
  const tidyForSave = async (dialogAsr: IAsrState): Promise<IAsrState> => {
    const asr = withoutPrimaryAsAsrLanguage(
      dialogAsr,
      primaryBcp47,
      needsSister
    );
    const method = explicitAsrMethod(asr.asrMethod);
    if (!method) return asr;
    // The list is cached from the dialog's own load. A failed lookup says
    // nothing about the method, so keep it: dropping it here would save the
    // team, step or project without its method over a network error.
    const methods = await getMethodsForAsr(asr.asrIso, token).catch(
      () => undefined
    );
    if (!methods) return asr;
    return { ...asr, asrMethod: listedAsrMethod(method, methods) };
  };

  const handleRun = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      if (!asrState) {
        onClose(false, asrState);
        return;
      }
      // tidyForSave catches its own lookup failure, so this can't reject.
      void tidyForSave(asrState).then((asr) => {
        // A project whose language differs from the team's keeps this choice
        // for its next run (a no-op otherwise). Step-language ASR is not the
        // project's vernacular, so it is not saved here.
        if (!stepAsr) saveProjectAsrSettings(asr);
        onClose(false, asr);
      });
    });
  };

  const handleSaveTeamDefault = () => {
    if (!asrState) return;
    // tidyForSave catches its own lookup failure, so this can't reject.
    void tidyForSave(asrState).then((asr) => {
      if (stepAsr) saveStepAsrSettings(asr, stepAsr.stepId);
      else saveTeamAsrSettings(asr);
      showMessage(t.asrTeamDefaultSaved);
    });
  };

  const settingsIncomplete =
    !asrState?.target ||
    (asrState?.target === AsrTarget.alphabet &&
      !isLangSet(asrState?.language?.bcp47));

  const reportLoadFailure = (err: unknown) => {
    logError(Severity.error, errorReporter, toError(err));
    setLoadFailed(true);
  };

  const loadSisterSuggestions = (bcp47: string) => {
    if (stepAsr) {
      // This step's language is not the vernacular, so its recommendations
      // live on the step its settings are read from.
      const { stepId } = stepAsr;
      const cached = getCachedStepSisterRecommendations(stepId);
      if (cached) {
        seedSuggestions(cached);
        return;
      }
      void fetchRecommendations(isoFromBcp47(bcp47), (found) =>
        saveStepSisterRecommendations(stepId, found)
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

  // Only an offline session has no token; ASR needs the service, so it can't load.
  const hasToken = token !== null;

  // Set once the dialog holds its seeded settings; an edit is never reseeded.
  const seeded = React.useRef(false);

  const seedDialog = async (isCancelled: () => boolean) => {
    const asr = stepAsr ? stepAsr.asr : await getAsrSettings();
    if (isCancelled()) return;
    // Settings can name the primary itself as the ASR language (e.g. a step
    // without a sister, or older team data), which can't be transcribed when a
    // sister is needed; start the sister picker empty instead.
    setAsrState(
      withoutPrimaryAsAsrLanguage(
        {
          target: asr?.target ?? AsrTarget.alphabet,
          language: asr?.language ?? initLang,
          asrIso: asr?.asrIso ?? 'eng',
          asrMethod: explicitAsrMethod(asr?.asrMethod),
          dialect: asr?.dialect,
          selectRoman: asr?.selectRoman ?? false,
        } as IAsrState,
        primaryBcp47,
        needsSister
      )
    );
    seeded.current = true;
    if (needsSister) loadSisterSuggestions(primaryBcp47);
  };

  React.useEffect(() => {
    if (!hasToken || !sisterKnown || seeded.current) return;
    let cancelled = false;
    seedDialog(() => cancelled).catch((err: unknown) => {
      if (!cancelled) reportLoadFailure(err);
    });
    return () => {
      cancelled = true;
    };
    // Seed once, when the sister check has answered. Later token refreshes or
    // settings-loader identity changes must not reload the dialog over an
    // edit already in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, sisterKnown]);

  const seeding = !asrState && !loadFailed;

  return (
    <StyledBox sx={{ minWidth: 120 }}>
      {loadFailed && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {t.asrRequestFailed}
        </Typography>
      )}
      {seeding && (
        <SeedingStatus message={hasToken ? undefined : ts.mustBeOnline} />
      )}
      {asrState && (
        <AsrSettings
          asr={asrState}
          setAsr={setAsrState}
          vernacularBcp47={primaryBcp47}
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
