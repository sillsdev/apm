import { useContext, useMemo } from 'react';
import {
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
import TaskList from '../TaskList';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { useArtifactType } from '../../crud/useArtifactType';
import {
  ArtifactTypeSlug,
  isPhraseSegmentArtifact,
} from '../../crud/artifactTypeSlug';
import { UnsavedContext } from '../../context/UnsavedContext';
import { related } from '../../crud/related';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useSnackBar } from '../../hoc/SnackBar';
import { completeStepAfterSave } from '../../context/completeStepAfterSave';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
} from '../../utils/namedSegments';
import { hasPhraseRegions } from './carefulSpeech/carefulSpeechBoundary';
import {
  mediaMatchesStepLanguage,
  phraseBtBoundaryRegionName,
} from './carefulSpeech/matchesGuidedOutputRow';
import { hasIncompletePhraseSegmentRecordings } from './phraseSegmentRecordingComplete';
import StepMessage from './boldClause/StepMessage';
import { useTranscribeStepRole } from './transcribe/useTranscribeStepRole';
import { useTranscribeStepNav } from './transcribe/useTranscribeStepNav';
import { usePassageStepPermission } from '../../utils/usePassageStepPermission';

const TranscriberContainer = styled(Box)<BoxProps>(() => ({
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}));

interface IProps {
  artifactTypeId: string | null;
}

export function PassageDetailTranscribe({ artifactTypeId }: IProps) {
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
    sharedResource,
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
  const { showMessage } = useSnackBar();
  const { setState } = useContext(PassageDetailContext);
  const hasPermission = usePassageStepPermission(
    currentstep,
    section,
    passage,
    sharedResource
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const { localizedArtifactTypeFromId, slugFromId } = useArtifactType();
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const {
    stepSettings,
    parsedSteps,
    hasChecking,
    nextStep,
    prevStep,
    curRole,
    stepLanguageBcp47,
  } = useTranscribeStepRole({
    currentstep,
    orgWorkflowSteps,
    hasPermission,
    artifactTypeId,
  });
  const { handleReopen, handleReject } = useTranscribeStepNav({
    currentstep,
    parsedSteps,
    hasChecking,
    nextStep,
    prevStep,
    curRole,
    setStepComplete,
    setCurrentStep,
  });

  const handleComplete = (complete: boolean) => {
    // Save and step-write failures are shown inside; only an onDone bug rejects, and it should surface.
    void completeStepAfterSave({
      stepId: currentstep,
      complete,
      waitForSaves: () => waitForSave(undefined, 200),
      setStepComplete,
      showMessage,
      // if we're now complete, go to the next step or passage
      onDone: complete ? gotoNextStep : undefined,
    });
  };

  const handleReloadPlayer = (playerMediafile: MediaFile) => {
    setState((s) => ({ ...s, playerMediafile }));
  };

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
    // Scope with the same step language the task list uses, so steps exempt from
    // language scoping (vernacular / Q&A / Retell) aren't hidden by a leftover
    // `language` setting.
    return rowData.some((r) => {
      if (r.artifactType !== btType) return false;
      if (related(r.mediafile, 'sourceMedia') !== mediafileId) return false;
      return mediaMatchesStepLanguage(r.mediafile, stepLanguageBcp47);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, artifactTypeId, mediafileId, stepLanguageBcp47]);

  if (missingPhraseSegmentRecordings) {
    return <StepMessage message={t.missingSegmentRecordings} />;
  }

  return Boolean(mediafileId) && hasBtRecordings ? (
    <TranscriberProvider
      artifactTypeId={artifactTypeId}
      curRole={curRole}
      stepLanguageBcp47={stepLanguageBcp47}
    >
      <Grid
        container
        direction="column"
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          flexWrap: 'nowrap',
          width: '100%',
          minWidth: 0,
        }}
      >
        {artifactTypeId && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flex: '1 1 0',
              minHeight: 0,
              width: '100%',
              minWidth: 0,
            }}
          >
            <Box
              sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}
            >
              <TaskList />
            </Box>
            <TranscriberContainer>
              <Transcriber
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
              flex: '1 1 0',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Transcriber
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
