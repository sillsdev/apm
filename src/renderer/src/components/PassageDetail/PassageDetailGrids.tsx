import React, { useState, useContext, useMemo, Suspense } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { Grid, Paper, Box, SxProps, Stack } from '@mui/material';

import { HeadHeight } from '../../layout';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { WorkflowSteps } from './WorkflowSteps';
import PassageDetailSectionPassage from './PassageDetailSectionPassage';
import PassageDetailStepComplete from './PassageDetailStepComplete';
import PassageDetailArtifacts from './Internalization/PassageDetailArtifacts';
import PassageDetailPrompt from './Prompt/PassageDetailPrompt';
import TeamCheckReference from './TeamCheckReference';
import PassageDetailPlayer from './PassageDetailPlayer';
import PassageDetailRecord from './PassageDetailRecord';
import PassageDetailItem from './PassageDetailItem';
import PassageDetailMarkVerses from './PassageDetailMarkVerses';
import PassageDetailCarefulSpeech from './PassageDetailCarefulSpeech';
import PassageDetailTranscribe from './PassageDetailTranscribe';
import PassageDetailChooser from './PassageDetailChooser';
import ConsultantCheck from './ConsultantCheck';
import TranscriptionTab from '../TranscriptionTab';
import {
  ArtifactTypeSlug,
  remoteIdGuid,
  ToolSlug,
  useArtifactType,
  useStepTool,
} from '../../crud';
import { Plan, IToolStrings } from '../../model';
import { NamedRegions, useMobile } from '../../utils';
import { useSelector, shallowEqual } from 'react-redux';
import { toolSelector } from '../../selector';
import Busy from '../Busy';
import { RecordKeyMap } from '@orbit/records';
import PassageDetailParatextIntegration from './PassageDetailParatextIntegration';
import { PassageDetailDiscuss } from './PassageDetailDiscuss';
import { addPt } from '../../utils/addPt';
import DiscussionPanel from '../Discussions/DiscussionPanel';
import { usePaneWidth } from '../usePaneWidth';
import { showsBoldDesktopStepComplete } from './boldDesktopStepComplete';

const KeyTerms = React.lazy(() => import('./Keyterms/KeyTerms'));

function phraseBackNamedRegionFromSettings(
  parsed: Record<string, unknown> | null
): NamedRegions {
  if (!parsed) return NamedRegions.BackTranslation;
  const nr = parsed.namedRegion;
  if (
    typeof nr === 'string' &&
    (Object.values(NamedRegions) as string[]).includes(nr)
  ) {
    return nr as NamedRegions;
  }
  return NamedRegions.BackTranslation;
}

function parseStepSettings(settings: unknown): Record<string, unknown> | null {
  if (!settings) return null;
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof settings === 'object') return settings as Record<string, unknown>;
  return null;
}

const descProps = { overflow: 'hidden', textOverflow: 'ellipsis' } as SxProps;
const rowProps = { alignItems: 'center', whiteSpace: 'nowrap' } as SxProps;

const PassageDetailGrids = () => {
  const [plan] = useGlobal('plan'); //will be constant here

  const [memory] = useGlobal('memory');
  const ctx = useContext(PassageDetailContext);
  const {
    currentstep,
    orgWorkflowSteps,
    mediafileId,
    sectionArr,
    isBoldWorkflow,
    discussOpen,
  } = ctx.state;

  const { tool, settings } = useStepTool(currentstep);
  const { slugFromId } = useArtifactType();
  const stepSettingsParsed = useMemo(
    () => parseStepSettings(settings),
    [settings]
  );
  const t = useSelector(toolSelector, shallowEqual) as IToolStrings;
  const { paneWidth, width, scrollbarWidth } = usePaneWidth();
  const { isMobile } = useMobile();

  const artifactId = useMemo(() => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    if (id)
      return (
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
      );
    return null;
  }, [stepSettingsParsed, memory?.keyMap]);

  const [communitySlugs] = useState([
    ArtifactTypeSlug.Retell,
    ArtifactTypeSlug.QandA,
  ]);
  const [wholeBackTranslationSlugs] = useState([
    ArtifactTypeSlug.WholeBackTranslation,
  ]);

  const phraseBackArtifactSlugs = useMemo((): ArtifactTypeSlug[] => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    if (id) {
      const resolved =
        (memory?.keyMap &&
          remoteIdGuid('artifacttype', id, memory.keyMap as RecordKeyMap)) ??
        id;
      const slug = slugFromId(resolved) as ArtifactTypeSlug;
      if (slug && slug !== ArtifactTypeSlug.Vernacular) return [slug];
    }
    return [ArtifactTypeSlug.PhraseBackTranslation];
  }, [stepSettingsParsed, memory?.keyMap, slugFromId]);

  const phraseBackNamedRegion = useMemo(
    () => phraseBackNamedRegionFromSettings(stepSettingsParsed),
    [stepSettingsParsed]
  );

  const plans = useMemo(() => {
    const plans = memory.cache.query((q) => q.findRecords('plan')) as Plan[];
    return plans.filter((p) => p.id === plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const headerToolLabel =
    tool && Object.prototype.hasOwnProperty.call(t, tool)
      ? addPt(t.getString(tool))
      : tool;
  const boldDesktopCenteredHeader = isBoldWorkflow && !isMobile;
  const MAGIC_NUMBER_THAT_MAKES_IT_FIT = 16;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        paddingTop: `${HeadHeight}px`,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Grid
        container
        direction="row"
        sx={{ ...rowProps, minWidth: 0, flexWrap: 'wrap' }}
      >
        {!(
          isMobile &&
          (tool === ToolSlug.PhraseBackTranslate ||
            tool === ToolSlug.CarefulSpeech)
        ) && (
          <>
            {boldDesktopCenteredHeader ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
                  alignItems: 'center',
                  columnGap: 1,
                  flexGrow: 1,
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Box
                  sx={{
                    alignItems: 'center',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <PassageDetailSectionPassage />
                </Box>
                <Box
                  id="tool"
                  sx={{
                    alignItems: 'center',
                    minWidth: 0,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    justifySelf: 'center',
                    textAlign: 'center',
                  }}
                >
                  {headerToolLabel}
                </Box>
                <Box
                  id={
                    showsBoldDesktopStepComplete(tool)
                      ? 'stepcomplete'
                      : undefined
                  }
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  {showsBoldDesktopStepComplete(tool) && (
                    <PassageDetailStepComplete />
                  )}
                </Box>
              </Box>
            ) : (
              <Grid
                container
                direction="row"
                sx={{
                  alignItems: 'center',
                  flexGrow: 1,
                  minWidth: 0,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Grid
                  sx={{ ...rowProps, minWidth: 0, flexShrink: 1 }}
                  size={{ xs: 'auto' }}
                >
                  <PassageDetailSectionPassage />
                </Grid>
                <Grid
                  id="tool"
                  sx={{
                    alignItems: 'center',
                    minWidth: 0,
                    flexShrink: 1,
                    whiteSpace: 'nowrap',
                    ml: 'auto',
                  }}
                  size={{ xs: 'auto' }}
                >
                  {headerToolLabel}
                </Grid>
                {!isBoldWorkflow && (
                  <Grid
                    id="stepcomplete"
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      minWidth: 0,
                      flexShrink: 0,
                      ml: 'auto',
                    }}
                    size={{ xs: 'auto' }}
                  >
                    <PassageDetailStepComplete />
                  </Grid>
                )}
              </Grid>
            )}
            <Grid
              sx={{
                ...descProps,
                position: 'sticky',
                top: 0,
                zIndex: (theme) => theme.zIndex.appBar,
                backgroundColor: 'background.default',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
              size={{ xs: 12 }}
            >
              <WorkflowSteps />
            </Grid>
          </>
        )}
        {tool === ToolSlug.Resource && (
          <Grid
            container
            direction="row"
            sx={{ ...rowProps, minWidth: 0, flexWrap: 'wrap' }}
          >
            <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
              <Grid container sx={{ minWidth: 0 }}>
                <PassageDetailChooser width={width - 24} sx={{ pl: 2 }} />
                <PassageDetailArtifacts />
              </Grid>
            </Grid>
          </Grid>
        )}
        {tool === ToolSlug.Prompt && (
          <Grid
            container
            direction="row"
            sx={{ ...rowProps, minWidth: 0, flexWrap: 'wrap', px: 2 }}
          >
            <Grid size={{ xs: 12 }} sx={{ minWidth: 0, width: '100%' }}>
              <PassageDetailPrompt width={Math.max(0, paneWidth - 40)} />
            </Grid>
          </Grid>
        )}
        {tool === ToolSlug.Paratext && (
          <Stack sx={{ width: '100%', minWidth: 0 }}>
            <PassageDetailChooser width={width - 24} sx={{ pl: 2 }} />
            <PassageDetailParatextIntegration />
          </Stack>
        )}
        {(tool === ToolSlug.Discuss ||
          tool === ToolSlug.TeamCheck ||
          tool === ToolSlug.Record ||
          tool === ToolSlug.Verses ||
          tool === ToolSlug.CarefulSpeech ||
          tool === ToolSlug.Transcribe ||
          tool === ToolSlug.ConsultantCheck ||
          tool === ToolSlug.KeyTerm) && (
          <Paper
            key={currentstep}
            sx={{ p: 0, margin: 'auto', width: `calc(100% - 32px)` }}
          >
            <Stack direction="row" spacing={1}>
              {tool !== ToolSlug.Transcribe &&
              tool !== ToolSlug.Verses &&
              tool !== ToolSlug.CarefulSpeech &&
              tool !== ToolSlug.Record &&
              tool !== ToolSlug.ConsultantCheck ? (
                <Stack
                  direction="column"
                  sx={{ width: '100%', minWidth: 0, maxWidth: paneWidth }}
                >
                  <PassageDetailChooser width={paneWidth} />
                  {(tool !== ToolSlug.KeyTerm || mediafileId) && (
                    <PassageDetailPlayer
                      width={Math.max(0, paneWidth - 40)}
                      allowZoomAndSpeed={true}
                    />
                  )}
                  {tool === ToolSlug.TeamCheck && <TeamCheckReference />}
                  {tool === ToolSlug.KeyTerm && (
                    <Suspense fallback={<Busy />}>
                      <KeyTerms width={paneWidth} />
                    </Suspense>
                  )}
                  {tool === ToolSlug.Discuss && (
                    <PassageDetailDiscuss
                      width={paneWidth}
                      currentStep={currentstep}
                    />
                  )}
                </Stack>
              ) : (
                <Grid
                  sx={{
                    ...descProps,
                    width: paneWidth,
                    maxWidth: paneWidth,
                    minWidth: 0,
                  }}
                  size={{ xs: 12 }}
                >
                  <PassageDetailChooser width={paneWidth} />
                  {tool === ToolSlug.Verses && (
                    <PassageDetailMarkVerses width={paneWidth} />
                  )}
                  {tool === ToolSlug.CarefulSpeech && (
                    <PassageDetailCarefulSpeech width={paneWidth} />
                  )}
                  {tool === ToolSlug.Transcribe && (
                    <PassageDetailTranscribe
                      width={Math.max(
                        0,
                        paneWidth -
                          MAGIC_NUMBER_THAT_MAKES_IT_FIT -
                          (discussOpen ? 0 : scrollbarWidth)
                      )}
                      artifactTypeId={artifactId}
                    />
                  )}
                  {tool === ToolSlug.Record && (
                    <PassageDetailRecord width={Math.max(0, paneWidth - 40)} />
                  )}
                  {tool === ToolSlug.ConsultantCheck && (
                    <ConsultantCheck width={paneWidth} />
                  )}
                </Grid>
              )}
              <DiscussionPanel />
            </Stack>
          </Paper>
        )}
        {(tool === ToolSlug.Community ||
          tool === ToolSlug.PhraseBackTranslate ||
          tool === ToolSlug.WholeBackTranslate) && (
          <Grid
            key={currentstep}
            container
            direction="row"
            sx={{ ...rowProps, minWidth: 0, flexWrap: 'wrap' }}
          >
            <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
              <PassageDetailItem
                width={width}
                slugs={
                  tool === ToolSlug.Community
                    ? communitySlugs
                    : tool === ToolSlug.PhraseBackTranslate
                      ? phraseBackArtifactSlugs
                      : wholeBackTranslationSlugs
                }
                showTopic={tool === ToolSlug.Community}
                segments={
                  tool === ToolSlug.PhraseBackTranslate
                    ? phraseBackNamedRegion
                    : undefined
                }
              />
            </Grid>
          </Grid>
        )}

        {(tool === ToolSlug.Export || tool === ToolSlug.Done) && (
          <Grid container sx={{ minWidth: 0 }}>
            <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
              <PassageDetailChooser width={width - 16} />
              {tool === ToolSlug.Export && (
                <TranscriptionTab
                  projectPlans={plans}
                  floatTop
                  step={currentstep}
                  orgSteps={orgWorkflowSteps}
                  sectionArr={sectionArr}
                />
              )}
            </Grid>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default PassageDetailGrids;
