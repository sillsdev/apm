import React from 'react';
import {
  IAsrState,
  asrStatesEqual,
  defaultAsrState,
  normalizeAsrState,
} from '../business/asr/asrState';
import { ILanguage } from '../control';
import { OrgWorkflowStepD, Project } from '../model';
import { TokenContext } from '../context/TokenProvider';
import { useGlobal } from '../context/useGlobal';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { useOrbitData } from '../hoc/useOrbitData';
import { isLangSet } from '../utils';
import { logError, Severity } from '../utils/logErrorService';
import { toError } from '../utils/toError';
import { useArtifactType } from './useArtifactType';
import { findRecord } from './tryFindRecord';
import { useOrgDefaults } from './useOrgDefaults';
import { useAsrDefaultsVersion } from './useAsrDefaultsVersion';
import {
  boldClauseAsrSettingsSource,
  boldClauseTranscriptionNeedsSisterLanguage,
  boldClauseTranscriptionStepLanguage,
  buildBoldClauseTranscriptionAsrState,
  findUpstreamRecordingWorkflowStep,
} from './boldClauseAsrSettings';

/**
 * ASR settings for a bold-clause transcription editor (Careful Speech, LWC):
 * loaded from the recording step (or the team default for vernacular audio),
 * reloaded when steps or saved defaults change.
 */
export function useBoldClauseTranscriptionAsrSettings(
  upstreamTool: string,
  recordingArtifactSlug: string,
  currentStepSettings?: unknown
) {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const [memory] = useGlobal('memory');
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project');
  const { getOrgDefault } = useOrgDefaults();
  const { slugFromId } = useArtifactType();
  const [errorReporter] = useGlobal('errorReporter');
  const [asrLoadFailed, setAsrLoadFailed] = React.useState(false);

  const orgId = organization as string | undefined;
  const currentstep =
    React.useContext(PassageDetailContext)?.state?.currentstep;
  const defaultsVersion = useAsrDefaultsVersion(orgId);
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;
  const [asrSettings, setAsrSettings] = React.useState<IAsrState>(() => ({
    ...defaultAsrState,
    asrIso: 'und',
    language: { ...defaultAsrState.language, bcp47: 'und', languageName: '' },
  }));
  const [needsSister, setNeedsSister] = React.useState(false);

  const projectLang = React.useMemo<ILanguage | undefined>(() => {
    if (!project) return undefined;
    const p = findRecord(memory, 'project', project) as Project | undefined;
    const bcp47 = p?.attributes?.language;
    if (!isLangSet(bcp47)) return undefined;
    return {
      bcp47,
      languageName: p?.attributes?.languageName ?? '',
      font: p?.attributes?.defaultFont ?? '',
      rtl: p?.attributes?.rtl ?? false,
      spellCheck: p?.attributes?.spellCheck ?? false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  React.useEffect(() => {
    let cancelled = false;
    const stepOptions = {
      orgSteps,
      slugFromId,
      upstreamTool,
      recordingArtifactSlug,
      getOrgDefault,
      orgId,
      currentStepSettings,
    };
    Promise.all([
      buildBoldClauseTranscriptionAsrState({
        ...stepOptions,
        asrDefault: defaultAsrState,
        projectLang,
        token,
      }),
      boldClauseTranscriptionNeedsSisterLanguage({ ...stepOptions, token }),
    ])
      .then(([next, needed]) => {
        if (cancelled) return;
        setAsrLoadFailed(false);
        setAsrSettings((prev) => (asrStatesEqual(prev, next) ? prev : next));
        setNeedsSister((prev) => (prev === needed ? prev : needed));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
        setAsrLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // slugFromId and getOrgDefault are recreated every render. defaultsVersion
    // is not read; it reloads after a team default is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgSteps,
    upstreamTool,
    recordingArtifactSlug,
    orgId,
    defaultsVersion,
    projectLang,
    currentStepSettings,
    token,
    errorReporter,
  ]);

  const needsSisterLanguage = React.useCallback(
    () => needsSister,
    [needsSister]
  );

  const asrIsoReady = isLangSet(normalizeAsrState(asrSettings)?.asrIso);

  const stepLanguageBcp47 = React.useMemo(
    () =>
      boldClauseTranscriptionStepLanguage({
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        currentStepSettings,
      }),
    // slugFromId and getOrgDefault are recreated every render; defaultsVersion
    // stands in for the team defaults getOrgDefault reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orgSteps,
      upstreamTool,
      recordingArtifactSlug,
      orgId,
      defaultsVersion,
      currentStepSettings,
    ]
  );

  // The step these settings are read from, so a save from the ASR dialog
  // lands where it will be read back.
  const asrSettingsStepId = React.useMemo(() => {
    const source = boldClauseAsrSettingsSource(
      slugFromId,
      recordingArtifactSlug,
      getOrgDefault,
      orgId,
      currentStepSettings
    );
    if (source === 'current') return currentstep || undefined;
    return findUpstreamRecordingWorkflowStep(
      orgSteps,
      slugFromId,
      upstreamTool,
      recordingArtifactSlug
    )?.id;
    // slugFromId and getOrgDefault are recreated every render; defaultsVersion
    // stands in for the team defaults getOrgDefault reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgSteps,
    upstreamTool,
    recordingArtifactSlug,
    orgId,
    defaultsVersion,
    currentStepSettings,
    currentstep,
  ]);

  return {
    asrSettings,
    needsSisterLanguage,
    asrIsoReady,
    asrLoadFailed,
    stepLanguageBcp47,
    asrSettingsStepId,
  };
}
