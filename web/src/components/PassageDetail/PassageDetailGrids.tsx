import React, { useState, useContext, useMemo, Suspense } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useSelector, shallowEqual } from 'react-redux';
import { RecordKeyMap } from '@orbit/records';
import { useGlobal } from '../../context/useGlobal';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import {
  ArtifactTypeSlug,
  passageRefText,
  PassageReference,
  remoteIdGuid,
  sectionDescription,
  ToolSlug,
  useArtifactType,
  usePlanType,
  useSharedResRead,
  useStepTool,
} from '../../crud';
import { Plan, IToolStrings } from '../../model';
import { toolSelector } from '../../selector';
import { useMobile } from '../../utils';
import { addPt } from '../../utils/addPt';
import Busy from '../Busy';
import TranscriptionTab from '../TranscriptionTab';
import DiscussionDrawer from '../Discussions/DiscussionDrawer';
import { usePaneWidth } from '../usePaneWidth';
import PassageDetailLayout from './PassageDetailLayout';
import { WorkflowSteps } from './WorkflowSteps';
import PassageDetailStepComplete from './PassageDetailStepComplete';
import PassageDetailChooser from './PassageDetailChooser';
import PassageDetailPlayer from './PassageDetailPlayer';
import { isBoldClauseTranscriptionStep } from './boldClauseTranscription';
import PassageDetailArtifacts from './Internalization/PassageDetailArtifacts';
import PassageDetailPrompt from './Prompt/PassageDetailPrompt';
import PassageDetailParatextIntegration from './PassageDetailParatextIntegration';
import { PassageDetailDiscuss } from './PassageDetailDiscuss';
import TeamCheckReference from './TeamCheckReference';
import PassageDetailMarkVerses from './mobile/MarkVerses/PassageDetailMarkVerses';
import PassageDetailCarefulSpeech from './PassageDetailCarefulSpeech';
import PassageDetailPhraseBackTranslate from './PassageDetailPhraseBackTranslate';
import PassageDetailLwcTranslation from './PassageDetailLwcTranslation';
import PassageDetailLwcTranscription from './PassageDetailLwcTranscription';
import PassageDetailTranscribe from './PassageDetailTranscribe';
import PassageDetailRecord from './PassageDetailRecord';
import ConsultantCheck from './ConsultantCheck';
import PassageDetailItem from './PassageDetailItem';

const KeyTerms = React.lazy(() => import('./Keyterms/KeyTerms'));

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

const stepColumnTools = [
  ToolSlug.Discuss,
  ToolSlug.TeamCheck,
  ToolSlug.Record,
  ToolSlug.Verses,
  ToolSlug.CarefulSpeech,
  ToolSlug.PhraseBackTranslate,
  ToolSlug.Transcribe,
  ToolSlug.ConsultantCheck,
  ToolSlug.KeyTerm,
] as string[];

const clippedStepTools = [
  ToolSlug.Record,
  ToolSlug.Verses,
  ToolSlug.CarefulSpeech,
  ToolSlug.PhraseBackTranslate,
  ToolSlug.Transcribe,
  ToolSlug.ConsultantCheck,
] as string[];

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
  const { slugFromId } = useArtifactType();
  const stepSettingsParsed = useMemo(
    () => parseStepSettings(settings),
    [settings]
  );
  const t = useSelector(toolSelector, shallowEqual) as IToolStrings;
  const { width } = usePaneWidth();
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
    const plans = memory.cache.query((q) => q.findRecords('plan')) as Plan[];
    return plans.filter((p) => p.id === plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const headerToolLabel =
    tool && Object.prototype.hasOwnProperty.call(t, tool)
      ? addPt(t.getString(tool))
      : tool;
  const showsStepColumn = stepColumnTools.includes(tool ?? '');
  const clipsStepContent = clippedStepTools.includes(tool ?? '');
  // Transcribe stretches to the pane so its task list and text box can fill it.
  const fillsPane = tool === ToolSlug.Transcribe && !boldClauseTranscription;
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
      contentSx={{ maxWidth: '100%', px: 1.5 }}
      fill={fillsPane}
    >
      {tool === ToolSlug.Resource && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', minWidth: 0 }}>
          <PassageDetailChooser width={width} />
          <PassageDetailArtifacts />
        </Box>
      )}
      {tool === ToolSlug.Prompt && (
        <Box sx={{ minWidth: 0 }}>
          <PassageDetailPrompt width={width} />
        </Box>
      )}
      {tool === ToolSlug.Paratext && (
        <Stack sx={{ minWidth: 0 }}>
          <PassageDetailChooser width={width} />
          <PassageDetailParatextIntegration />
        </Stack>
      )}
      {showsStepColumn && (
        <>
          <Stack
            key={currentstep}
            sx={{
              minWidth: 0,
              ...(clipsStepContent ? { overflow: 'clip' } : {}),
              ...(fillsPane ? { flex: '1 1 0', minHeight: 0 } : {}),
            }}
          >
            <PassageDetailChooser width={width} />
            {showsStepPlayer && (
              <PassageDetailPlayer width={width} allowZoomAndSpeed={true} />
            )}
            {tool === ToolSlug.TeamCheck && <TeamCheckReference />}
            {tool === ToolSlug.KeyTerm && (
              <Suspense fallback={<Busy />}>
                <KeyTerms width={width} />
              </Suspense>
            )}
            {tool === ToolSlug.Discuss && (
              <PassageDetailDiscuss width={width} currentStep={currentstep} />
            )}
            {tool === ToolSlug.Verses && (
              <PassageDetailMarkVerses width={width} />
            )}
            {tool === ToolSlug.CarefulSpeech && (
              <PassageDetailCarefulSpeech width={width} />
            )}
            {tool === ToolSlug.PhraseBackTranslate && isBoldWorkflow && (
              <PassageDetailLwcTranslation width={width} />
            )}
            {tool === ToolSlug.PhraseBackTranslate && !isBoldWorkflow && (
              <PassageDetailPhraseBackTranslate width={width} />
            )}
            {boldClauseTranscription && (
              <PassageDetailLwcTranscription width={width} />
            )}
            {tool === ToolSlug.Transcribe && !boldClauseTranscription && (
              <PassageDetailTranscribe artifactTypeId={artifactId} />
            )}
            {tool === ToolSlug.Record && <PassageDetailRecord width={width} />}
            {tool === ToolSlug.ConsultantCheck && (
              <ConsultantCheck width={width} />
            )}
          </Stack>
          <DiscussionDrawer />
        </>
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
      {(tool === ToolSlug.Export || tool === ToolSlug.Done) && (
        <Box sx={{ minWidth: 0 }}>
          <PassageDetailChooser width={width} />
          {tool === ToolSlug.Export && (
            <TranscriptionTab
              projectPlans={plans}
              floatTop
              step={currentstep}
              orgSteps={orgWorkflowSteps}
              sectionArr={sectionArr}
            />
          )}
        </Box>
      )}
    </PassageDetailLayout>
  );
};

export default PassageDetailGrids;
