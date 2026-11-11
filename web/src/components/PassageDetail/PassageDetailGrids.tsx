import React, { useState, useContext, useMemo, Suspense } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { Paper, Box, Stack, Typography } from '@mui/material';

import { PassageDetailContext } from '../../context/PassageDetailContext';
import { WorkflowSteps } from './WorkflowSteps';
import PassageDetailLayout from './PassageDetailLayout';
import PassageDetailStepComplete from './PassageDetailStepComplete';
import PassageDetailArtifacts from './Internalization/PassageDetailArtifacts';
import PassageDetailPrompt from './Prompt/PassageDetailPrompt';
import TeamCheckReference from './TeamCheckReference';
import PassageDetailPlayer from './PassageDetailPlayer';
import PassageDetailRecord from './PassageDetailRecord';
import PassageDetailItem from './PassageDetailItem';
import PassageDetailMarkVerses from './mobile/MarkVerses/PassageDetailMarkVerses';
import PassageDetailCarefulSpeech from './PassageDetailCarefulSpeech';
import PassageDetailPhraseBackTranslate from './PassageDetailPhraseBackTranslate';
import PassageDetailLwcTranslation from './PassageDetailLwcTranslation';
import PassageDetailLwcTranscription from './PassageDetailLwcTranscription';
import PassageDetailTranscribe from './PassageDetailTranscribe';
import PassageDetailChooser from './PassageDetailChooser';
import ConsultantCheck from './ConsultantCheck';
import TranscriptionTab from '../TranscriptionTab';
import {
  ArtifactTypeSlug,
  passageRefText,
  PassageReference,
  parseStepSettings,
  sectionDescription,
  ToolSlug,
  toolClipsPaperContent,
  toolShowsChooserNoPaper,
  toolShowsStepInstructions,
  toolShowsStepPaper,
  useArtifactType,
  usePlanType,
  useSharedResRead,
  useStepTool,
} from '../../crud';
import {
  IToolStrings,
  OrgWorkflowStepD,
  Plan,
  SectionArray,
} from '../../model';
import { useMobile } from '../../utils';
import { useSelector, shallowEqual } from 'react-redux';
import { toolSelector } from '../../selector';
import Busy from '../Busy';
import PassageDetailParatextIntegration from './PassageDetailParatextIntegration';
import { PassageDetailDiscuss } from './PassageDetailDiscuss';
import { addPt } from '../../utils/addPt';
import DiscussionPanel from '../Discussions/DiscussionPanel';
import { usePaneWidth } from '../usePaneWidth';
import { isBoldClauseTranscriptionStep } from './boldClauseTranscription';
import { findRecords } from '../../crud/tryFindRecord';

const KeyTerms = React.lazy(() => import('./Keyterms/KeyTerms'));

function ChooserStepBody({
  tool,
  width,
  currentstep,
  orgWorkflowSteps,
  sectionArr,
  plans,
}: {
  tool: string | undefined;
  width: number;
  currentstep: string;
  orgWorkflowSteps: OrgWorkflowStepD[];
  sectionArr: SectionArray;
  plans: Plan[];
}) {
  if (tool === ToolSlug.Resource) return <PassageDetailArtifacts />;
  if (tool === ToolSlug.Paratext) return <PassageDetailParatextIntegration />;
  if (tool === ToolSlug.Export) {
    return (
      <TranscriptionTab
        projectPlans={plans}
        floatTop
        step={currentstep}
        orgSteps={orgWorkflowSteps}
        sectionArr={sectionArr}
      />
    );
  }
  if (toolShowsStepInstructions(tool)) {
    return (
      <PassageDetailDiscuss width={width - 24} currentStep={currentstep} />
    );
  }
  return null;
}

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
    section,
    passage,
    allBookData,
  } = ctx.state;

  const { tool, settings } = useStepTool(currentstep);
  const { getSharedResource } = useSharedResRead();
  const sharedResource = getSharedResource(passage);
  const sectionMap = new Map<number, string>(sectionArr);
  const planType = usePlanType();
  const isFlat = useMemo(
    () => planType(plan)?.flat,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );
  const passNum = !isFlat ? passage : undefined;
  const sectionPassageRef = passageRefText(passage, allBookData);
  const sectionPassageRefDelim =
    sectionPassageRef !== '' ? `\u00A0-\u00A0` : '';
  const { slugFromId, localIdFromIdOrSlug } = useArtifactType();
  const stepSettingsParsed = useMemo(
    () => parseStepSettings(settings),
    [settings]
  );
  const t = useSelector(toolSelector, shallowEqual) as IToolStrings;
  const { paneWidth, width, scrollbarWidth } = usePaneWidth();
  const { isMobile } = useMobile();

  const artifactId = useMemo(() => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    return localIdFromIdOrSlug(id);
  }, [stepSettingsParsed, localIdFromIdOrSlug]);

  const [communitySlugs] = useState([
    ArtifactTypeSlug.Retell,
    ArtifactTypeSlug.QandA,
  ]);
  const [wholeBackTranslationSlugs] = useState([
    ArtifactTypeSlug.WholeBackTranslation,
  ]);

  const artifactSlug = useMemo(() => {
    if (!artifactId) return null;
    return slugFromId(artifactId);
  }, [artifactId, slugFromId]);

  const boldClauseTranscription = isBoldClauseTranscriptionStep(
    tool ?? '',
    isBoldWorkflow,
    artifactSlug
  );

  const plans = useMemo(() => {
    // Orbit plan table rows match Plan.
    return (findRecords(memory, 'plan') as Plan[]).filter((p) => p.id === plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const headerToolLabel =
    tool && Object.prototype.hasOwnProperty.call(t, tool)
      ? addPt(t.getString(tool) ?? tool)
      : tool;
  // The step content sits in a Paper of `calc(100% - 32px)`; a player sized to
  // the full pane would spill past that Paper (the outer Box clips it, cutting
  // off the waveform's right edge and the controls below). Match the `- 40`
  // used by the other step players so the player stays inside the Paper.
  const MAGIC_NUMBER_THAT_MAKES_IT_FIT = 40;
  // Width for a step's audio player so it fits the pane without clipping the
  // right-edge controls: pane minus padding and (when shown) the scrollbar.
  // Pass this to every step player so a new consumer can't forget the fit math.
  const playerPaneWidth = Math.max(
    0,
    paneWidth -
      MAGIC_NUMBER_THAT_MAKES_IT_FIT -
      (discussOpen ? 0 : scrollbarWidth)
  );
  // Same fit math for steps that render their own full-width control instead of
  // a player, so they can't overflow the Paper either.
  const fittedPaneWidth = Math.max(
    0,
    paneWidth - MAGIC_NUMBER_THAT_MAKES_IT_FIT
  );
  const showsChooser = toolShowsChooserNoPaper(tool);
  const showsStepPaper = toolShowsStepPaper(tool);
  const clipsStepContent = toolClipsPaperContent(tool);
  const showsStepPlayer =
    tool === ToolSlug.Discuss ||
    tool === ToolSlug.TeamCheck ||
    (tool === ToolSlug.KeyTerm && Boolean(mediafileId));
  const showHeader = !(
    isMobile &&
    (tool === ToolSlug.PhraseBackTranslate ||
      tool === ToolSlug.CarefulSpeech ||
      boldClauseTranscription)
  );
  const headerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          minWidth: 0,
          width: '100%',
        }}
      >
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <Typography noWrap id="sectionpassagetitle">
            {sectionDescription(section, sectionMap, passNum)}
            {sectionPassageRefDelim}
            <PassageReference
              passage={passage}
              bookData={allBookData}
              flat={isFlat}
              sharedResource={sharedResource}
              fontSize="inherit"
            />
          </Typography>
        </Box>
        <Box id="tool" sx={{ flexShrink: 0 }}>
          <Typography noWrap>{headerToolLabel}</Typography>
        </Box>
        <Box
          id="stepcomplete"
          sx={{
            display: 'flex',
            flex: '1 1 0',
            minWidth: 0,
            justifyContent: 'flex-end',
          }}
        >
          <PassageDetailStepComplete />
        </Box>
      </Stack>
      <Box>
        <WorkflowSteps />
      </Box>
    </Box>
  );

  return (
    <PassageDetailLayout
      header={showHeader ? headerContent : null}
      headerSx={
        showHeader
          ? {
              py: 1,
              px: 1.5,
              backgroundColor: 'background.default',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }
          : undefined
      }
      contentSx={{ maxWidth: '100%' }}
    >
      {showsChooser && (
        <Box
          sx={{
            minWidth: 0,
            ...(tool === ToolSlug.Resource
              ? { display: 'flex', flexWrap: 'wrap' }
              : {}),
          }}
        >
          <PassageDetailChooser width={width - 24} sx={{ pl: 2 }} />
          <ChooserStepBody
            tool={tool}
            width={width}
            currentstep={currentstep}
            orgWorkflowSteps={orgWorkflowSteps}
            sectionArr={sectionArr}
            plans={plans}
          />
        </Box>
      )}
      {tool === ToolSlug.Prompt && (
        <Box sx={{ minWidth: 0, px: 2 }}>
          <PassageDetailPrompt width={fittedPaneWidth} />
        </Box>
      )}
      {showsStepPaper && (
        <Paper
          key={currentstep}
          sx={{ p: 0, mx: 'auto', width: `calc(100% - 32px)` }}
        >
          <Stack direction="row" spacing={1}>
            <Stack
              sx={{
                width: '100%',
                maxWidth: paneWidth,
                minWidth: 0,
                ...(clipsStepContent ? { overflow: 'clip' } : {}),
              }}
            >
              <PassageDetailChooser width={paneWidth} />
              {showsStepPlayer && (
                <PassageDetailPlayer
                  width={fittedPaneWidth}
                  allowZoomAndSpeed={true}
                />
              )}
              {tool === ToolSlug.TeamCheck && <TeamCheckReference />}
              {tool === ToolSlug.KeyTerm && (
                <Suspense fallback={<Busy />}>
                  <KeyTerms width={paneWidth} />
                </Suspense>
              )}
              {toolShowsStepInstructions(tool) && (
                <PassageDetailDiscuss
                  width={paneWidth}
                  currentStep={currentstep}
                />
              )}
              {tool === ToolSlug.Verses && (
                <PassageDetailMarkVerses width={paneWidth} />
              )}
              {tool === ToolSlug.CarefulSpeech && (
                <PassageDetailCarefulSpeech width={playerPaneWidth} />
              )}
              {tool === ToolSlug.PhraseBackTranslate && isBoldWorkflow && (
                <PassageDetailLwcTranslation width={paneWidth} />
              )}
              {tool === ToolSlug.PhraseBackTranslate && !isBoldWorkflow && (
                <PassageDetailPhraseBackTranslate width={playerPaneWidth} />
              )}
              {boldClauseTranscription && (
                <PassageDetailLwcTranscription width={paneWidth} />
              )}
              {tool === ToolSlug.Transcribe && !boldClauseTranscription && (
                <PassageDetailTranscribe
                  width={playerPaneWidth}
                  artifactTypeId={artifactId}
                />
              )}
              {tool === ToolSlug.Record && (
                <PassageDetailRecord width={fittedPaneWidth} />
              )}
              {tool === ToolSlug.ConsultantCheck && (
                <ConsultantCheck width={playerPaneWidth} />
              )}
            </Stack>
            <DiscussionPanel />
          </Stack>
        </Paper>
      )}
      {(tool === ToolSlug.Community ||
        tool === ToolSlug.WholeBackTranslate) && (
        <Box key={currentstep} sx={{ minWidth: 0 }}>
          <PassageDetailItem
            width={width}
            slugs={
              tool === ToolSlug.Community
                ? communitySlugs
                : wholeBackTranslationSlugs
            }
            showTopic={tool === ToolSlug.Community}
            segments={undefined}
          />
        </Box>
      )}
    </PassageDetailLayout>
  );
};

export default PassageDetailGrids;
