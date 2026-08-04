import { useContext, useMemo } from 'react';
import {
  ActivityStates,
  ISharedStrings,
  ITranscriberStrings,
  MediaFile,
  MediaFileD,
} from '../../model';
import { Grid, Typography, Box, BoxProps, styled } from '@mui/material';
import { TranscriberProvider } from '../../context/TranscriberContext';
import Transcriber from '../../components/Transcriber';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useRenderProfiler, useWhyRender } from '../../utils/perf';
import { sharedSelector, transcriberSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import TaskList, { TaskTableWidth } from '../TaskList';
import { ToolSlug, useStepTool } from '../../crud';
import { JSONParse } from '../../utils';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { useArtifactType } from '../../crud/useArtifactType';
import {
  ArtifactTypeSlug,
  isPhraseSegmentArtifact,
} from '../../crud/artifactTypeSlug';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useStepPermissions } from '../../utils/useStepPermission';
import {
  artifactUsesOrgVernacularLanguage,
  parseStepLanguageField,
} from '../../crud/transcribeStepAsrSettings';
import { related } from '../../crud/related';
import { useOrbitData } from '../../hoc/useOrbitData';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
} from '../../utils/namedSegments';
import { hasPhraseRegions } from './carefulSpeech/carefulSpeechBoundary';
import {
  parseMediaLanguageField,
  phraseBtBoundaryRegionName,
} from './carefulSpeech/matchesGuidedOutputRow';
import { hasIncompletePhraseSegmentRecordings } from './phraseSegmentRecordingComplete';
import StepMessage from './boldClause/StepMessage';

const TranscriberContainer = styled(Box)<BoxProps>(() => ({
  zIndex: 1,
  position: 'absolute',
  left: `${TaskTableWidth + 4}px`,
}));

interface IProps {
  width: number;
  artifactTypeId: string | null;
}

export function PassageDetailTranscribe({ width, artifactTypeId }: IProps) {
  useRenderProfiler('PassageDetailTranscribe');
  const {
    mediafileId,
    section,
    currentstep,
    orgWorkflowSteps,
    setStepComplete,
    setCurrentStep,
    gotoNextStep,
    rowData,
    psgCompleted,
    passage,
  } = usePassageDetailContext();
  useWhyRender('PassageDetailTranscribe', {
    mediafileId,
    section,
    currentstep,
    orgWorkflowSteps,
    rowData,
    psgCompleted,
    passage,
  });
  const { waitForSave } = useContext(UnsavedContext).state;
  const { setState } = useContext(PassageDetailContext);
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission = canDoSectionStep(currentstep, section);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const { localizedArtifactTypeFromId, slugFromId } = useArtifactType();
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const { settings: workflowStepSettingsRaw } = useStepTool(currentstep);
  const stepSettings = useMemo(() => {
    if (!workflowStepSettingsRaw || workflowStepSettingsRaw === '') return '{}';
    return typeof workflowStepSettingsRaw === 'string'
      ? workflowStepSettingsRaw
      : JSON.stringify(workflowStepSettingsRaw);
  }, [workflowStepSettingsRaw]);

  interface IStep {
    id: string;
    sequencenum: number;
    tool: string;
    settings: string;
  }

  const parsedSteps = useMemo(() => {
    if (!orgWorkflowSteps) return [];
    return orgWorkflowSteps
      .sort(
        (a, b) =>
          (a.attributes.sequencenum ?? 0) - (b.attributes.sequencenum ?? 0)
      )
      .map((s, ix) => {
        const toolData = JSONParse(s?.attributes?.tool) as {
          tool?: string;
          settings?: string | object;
        };
        return {
          id: s.id,
          sequencenum: ix,
          tool: toolData.tool ?? '',
          settings:
            typeof toolData.settings === 'string'
              ? toolData.settings || '{}'
              : JSON.stringify(toolData.settings ?? {}),
        } as IStep;
      });
  }, [orgWorkflowSteps]);

  const vernacularSteps = useMemo(() => {
    return parsedSteps.filter(
      (s) =>
        s.tool === ToolSlug.Transcribe && !JSON.parse(s.settings).artifactTypeId
    );
  }, [parsedSteps]);

  const hasChecking = useMemo(() => {
    return (
      vernacularSteps.length > 1 &&
      (vernacularSteps[1] as IStep).sequencenum ===
        (vernacularSteps[0] as IStep).sequencenum + 1
    );
  }, [vernacularSteps]);

  const nextStep = useMemo(() => {
    if (!currentstep || !parsedSteps) return null;
    let found = false;
    for (const s of parsedSteps) {
      if (s.id === currentstep) {
        found = true;
        continue;
      }
      if (!found) continue;
      return s.id;
    }
    return null;
  }, [currentstep, parsedSteps]);

  const prevStep = useMemo(() => {
    if (!currentstep || !parsedSteps) return null;
    let found = '';
    for (const s of parsedSteps) {
      if (s.id === currentstep) {
        break;
      } else {
        found = s.id;
      }
    }
    return found;
  }, [currentstep, parsedSteps]);

  const curRole = useMemo(() => {
    if (!currentstep) return undefined;
    if (!hasPermission) return 'view';
    if (!hasChecking) return 'transcriber';
    if (JSON.parse(stepSettings || '{}')?.artifactTypeId) return 'transcriber';
    if ((vernacularSteps[0] as IStep)?.id === currentstep) return 'transcriber';
    return 'editor';
  }, [currentstep, vernacularSteps, stepSettings, hasChecking, hasPermission]);

  const handleComplete = (complete: boolean) => {
    waitForSave(undefined, 200).finally(async () => {
      await setStepComplete(currentstep, complete);
      //if we're now complete, go to the next step or passage
      if (complete) gotoNextStep();
    });
  };

  const uncompletedSteps = async () => {
    await setStepComplete(currentstep, false);
    if (hasChecking && nextStep) await setStepComplete(nextStep, false);
    if (curRole === 'editor' && prevStep) setCurrentStep(prevStep || '');
  };

  const handleReopen = () => {
    uncompletedSteps();
  };

  const handleReject = async (reason: string) => {
    uncompletedSteps();
    if (reason === ActivityStates.NeedsNewRecording) {
      const curStep = parsedSteps.find((s) => s.id === currentstep);
      if (curStep?.settings === '{}') {
        // only for vernacular
        const recordStep = parsedSteps.find((s) => s.tool === ToolSlug.Record);
        if (recordStep) {
          await setStepComplete(recordStep.id, false);
          setCurrentStep(recordStep.id);
          return;
        }
      }
    }
    if (curRole === 'editor' && prevStep) {
      await setStepComplete(prevStep, false);
      setCurrentStep(prevStep);
    }
  };

  const handleReloadPlayer = (playerMediafile: MediaFile) => {
    setState((s) => ({ ...s, playerMediafile }));
  };

  const stepLanguageBcp47 = useMemo(() => {
    // Claude says:
    // Vernacular / Q&A / Retell steps transcribe in the org vernacular, not a step
    // language, and their media carry no languagebcp47 — honoring a leftover
    // `language` value here would scope them to nothing.
    if (!artifactTypeId) return undefined;
    if (
      artifactUsesOrgVernacularLanguage(
        slugFromId(artifactTypeId) as ArtifactTypeSlug
      )
    )
      return undefined;
    const { bcp47 } = parseMediaLanguageField(
      (() => {
        try {
          return (JSON.parse(stepSettings) as { language?: unknown }).language;
        } catch {
          return undefined;
        }
      })()
    );
    return bcp47 !== 'und' ? bcp47 : undefined;
  }, [stepSettings, artifactTypeId, slugFromId]);

  const phraseArtifactSlug = useMemo(() => {
    if (!artifactTypeId) return null;
    const slug = slugFromId(artifactTypeId) as ArtifactTypeSlug;
    return isPhraseSegmentArtifact(slug) ? slug : null;
  }, [artifactTypeId, slugFromId]);

  const mediafile = useMemo(
    () => mediafiles.find((m) => m.id === mediafileId),
    [mediafiles, mediafileId]
  );

  const phraseRegions = useMemo(() => {
    if (!phraseArtifactSlug || !mediafile) return [];
    const allSegs = mediafile.attributes?.segments ?? '[]';
    const namedRegion =
      phraseArtifactSlug === ArtifactTypeSlug.CarefulSpeech
        ? NamedRegions.Clause
        : stepLanguageBcp47
          ? phraseBtBoundaryRegionName(stepLanguageBcp47)
          : NamedRegions.BackTranslation;
    const primary = getSegments(namedRegion, allSegs);
    if (hasPhraseRegions(primary)) return getSortedRegions(primary);
    if (
      phraseArtifactSlug === ArtifactTypeSlug.PhraseBackTranslation &&
      stepLanguageBcp47
    ) {
      const fallback = getSegments(NamedRegions.BackTranslation, allSegs);
      if (hasPhraseRegions(fallback)) return getSortedRegions(fallback);
    }
    return [];
  }, [phraseArtifactSlug, mediafile, stepLanguageBcp47]);

  const missingPhraseSegmentRecordings = useMemo(() => {
    if (!phraseArtifactSlug || !artifactTypeId) return false;
    return hasIncompletePhraseSegmentRecordings(
      phraseRegions,
      rowData,
      artifactTypeId,
      mediafile?.attributes?.versionNumber ?? 0,
      mediafileId,
      stepLanguageBcp47
    );
  }, [
    phraseArtifactSlug,
    artifactTypeId,
    phraseRegions,
    rowData,
    mediafile,
    mediafileId,
    stepLanguageBcp47,
  ]);

  const hasBtRecordings = useMemo(() => {
    if (!artifactTypeId) return true; // we're not transcribing back translations
    const btType = localizedArtifactTypeFromId(artifactTypeId);
    const primaryBcp = parseStepLanguageField(
      (() => {
        try {
          return (JSON.parse(stepSettings) as { language?: unknown }).language;
        } catch {
          return undefined;
        }
      })()
    ).bcp47;
    return rowData.some((r) => {
      if (r.artifactType !== btType) return false;
      if (related(r.mediafile, 'sourceMedia') !== mediafileId) return false;
      if (primaryBcp && primaryBcp !== 'und') {
        const rowBcp = parseStepLanguageField(
          r.mediafile.attributes?.languagebcp47
        ).bcp47;
        if (rowBcp !== primaryBcp) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, artifactTypeId, mediafileId, stepSettings]);
  const MAGIC_NUMBER_THAT_MAKES_IT_FIT = 20;

  if (missingPhraseSegmentRecordings) {
    return <StepMessage message={t.missingSegmentRecordings} />;
  }

  return Boolean(mediafileId) && hasBtRecordings ? (
    <TranscriberProvider
      artifactTypeId={artifactTypeId}
      curRole={curRole as string}
      stepLanguageBcp47={stepLanguageBcp47}
    >
      <Grid
        container
        direction="column"
        sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
      >
        {artifactTypeId && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <Box>
              <TaskList />
            </Box>
            <TranscriberContainer>
              <Transcriber
                defaultWidth={
                  width - TaskTableWidth - MAGIC_NUMBER_THAT_MAKES_IT_FIT
                }
                stepSettings={stepSettings}
                hasPermission={hasPermission}
                onReject={handleReject}
                onReopen={handleReopen}
                onReloadPlayer={handleReloadPlayer}
              />
            </TranscriberContainer>
          </Box>
        )}
        {artifactTypeId == null && (
          <Box
            sx={{
              width: '100%',
              maxWidth: width,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Transcriber
              defaultWidth={Math.max(0, width - MAGIC_NUMBER_THAT_MAKES_IT_FIT)}
              stepSettings={stepSettings ?? undefined}
              hasChecking={hasChecking}
              setComplete={handleComplete}
              hasPermission={hasPermission}
              onReject={handleReject}
              onReopen={handleReopen}
              onReloadPlayer={handleReloadPlayer}
            />
          </Box>
        )}
      </Grid>
    </TranscriberProvider>
  ) : (
    <Typography variant="h2" align="center">
      {ts.noAudio}
    </Typography>
  );
}

export default PassageDetailTranscribe;
