import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  Suspense,
} from 'react';
import { useGlobal } from '../context/useGlobal';
import { useLocation, useParams } from 'react-router-dom';
import { Grid, debounce, Paper, Box, SxProps, Stack } from '@mui/material';

import AppHead from '../components/App/AppHead';
import { HeadHeight } from '../App';
import {
  PassageDetailProvider,
  PassageDetailContext,
} from '../context/PassageDetailContext';
import StickyRedirect from '../components/StickyRedirect';
import { WorkflowSteps } from '../components/PassageDetail/WorkflowSteps';
import PassageDetailSectionPassage from '../components/PassageDetail/PassageDetailSectionPassage';
import PassageDetailStepComplete from '../components/PassageDetail/PassageDetailStepComplete';
import PassageDetailArtifacts from '../components/PassageDetail/Internalization/PassageDetailArtifacts';
import TeamCheckReference from '../components/PassageDetail/TeamCheckReference';
import PassageDetailPlayer from '../components/PassageDetail/PassageDetailPlayer';
import PassageDetailRecord from '../components/PassageDetail/PassageDetailRecord';
import PassageDetailItem from '../components/PassageDetail/PassageDetailItem';
import PassageDetailMarkVerses from '../components/PassageDetail/PassageDetailMarkVerses';
import PassageDetailTranscribe from '../components/PassageDetail/PassageDetailTranscribe';
import PassageDetailChooser from '../components/PassageDetail/PassageDetailChooser';
import ConsultantCheck from '../components/PassageDetail/ConsultantCheck';
import TranscriptionTab from '../components/TranscriptionTab';
import {
  ArtifactTypeSlug,
  remoteIdGuid,
  ToolSlug,
  useProjectType,
  useStepTool,
  useUrlContext,
} from '../crud';
import { Plan, IToolStrings } from '../model';
import { NamedRegions } from '../utils';
import { useSelector, shallowEqual } from 'react-redux';
import { toolSelector } from '../selector';
import Busy from '../components/Busy';
import { RecordKeyMap } from '@orbit/records';
import PassageDetailParatextIntegration from '../components/PassageDetail/PassageDetailParatextIntegration';
import { PassageDetailDiscuss } from '../components/PassageDetail/PassageDetailDiscuss';
import { addPt } from '../utils/addPt';
import DiscussionPanel from '../components/Discussions/DiscussionPanel';

const KeyTerms = React.lazy(
  () => import('../components/PassageDetail/Keyterms/KeyTerms')
);

const descProps = { overflow: 'hidden', textOverflow: 'ellipsis' } as SxProps;
const rowProps = { alignItems: 'center', whiteSpace: 'nowrap' } as SxProps;

const PassageDetailGrids = () => {
  const [plan] = useGlobal('plan'); //will be constant here
  const [width, setWidth] = useState(window.innerWidth);
  const widthRef = React.useRef(window.innerWidth);

  const [memory] = useGlobal('memory');
  const ctx = useContext(PassageDetailContext);
  const {
    currentstep,
    discussionSize,
    setDiscussionSize,
    orgWorkflowSteps,
    mediafileId,
    sectionArr,
    discussOpen,
  } = ctx.state;

  const { tool, settings } = useStepTool(currentstep);
  const discussionSizeRef = React.useRef(discussionSize);
  const t = useSelector(toolSelector, shallowEqual) as IToolStrings;
  const [paneWidth, setPaneWidth] = useState(0);
  const hasVerticalScrollbarRef = React.useRef(false);

  // Detect vertical scrollbar - use ref to avoid re-renders
  useEffect(() => {
    const checkScrollbar = () => {
      // Check if document body has vertical scrollbar
      const hasScrollbar =
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight;
      hasVerticalScrollbarRef.current = hasScrollbar;
    };

    checkScrollbar();
    const handleResize = debounce(() => {
      checkScrollbar();
    }, 200);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    discussionSizeRef.current = discussionSize;
    widthRef.current = width;
    let newPaneWidth = widthRef.current;
    if (discussOpen) {
      newPaneWidth -= discussionSize.width;
    }
    newPaneWidth = Math.max(0, newPaneWidth);
    setPaneWidth(newPaneWidth);
  }, [discussionSize, width, discussOpen]);

  const artifactId = useMemo(() => {
    if (settings) {
      const id = JSON.parse(settings).artifactTypeId;
      if (id)
        return (
          remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
        );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const [communitySlugs] = useState([
    ArtifactTypeSlug.Retell,
    ArtifactTypeSlug.QandA,
  ]);
  const [phraseBackTranslationSlugs] = useState([
    ArtifactTypeSlug.PhraseBackTranslation,
  ]);
  const [wholeBackTranslationSlugs] = useState([
    ArtifactTypeSlug.WholeBackTranslation,
  ]);

  const setDimensions = () => {
    // Always use actual window width - let components adapt to available space
    const newWidth = window.innerWidth;
    setWidth(newWidth);

    let newDiscWidth = discussionSizeRef.current.width;
    if (newDiscWidth > 450) newDiscWidth = 450;
    const newDiscHeight = window.innerHeight - 170;
    if (
      discussionSizeRef.current.height !== newDiscHeight ||
      discussionSizeRef.current.width !== newDiscWidth
    )
      setDiscussionSize({
        width: newDiscWidth, //should we be smarter here?
        height: newDiscHeight,
      });
  };

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const plans = useMemo(() => {
    const plans = memory.cache.query((q) => q.findRecords('plan')) as Plan[];
    return plans.filter((p) => p.id === plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

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
            }}
            size={{ xs: 'auto' }}
          >
            {tool && Object.prototype.hasOwnProperty.call(t, tool)
              ? addPt(t.getString(tool))
              : tool}
          </Grid>
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
        </Grid>
        <Grid sx={descProps} size={{ xs: 12 }}>
          <WorkflowSteps />
        </Grid>
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
                  {tool === ToolSlug.Transcribe && (
                    <PassageDetailTranscribe
                      width={Math.max(
                        0,
                        paneWidth -
                          16 -
                          (hasVerticalScrollbarRef.current ? 20 : 0)
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
                      ? phraseBackTranslationSlugs
                      : wholeBackTranslationSlugs
                }
                showTopic={tool === ToolSlug.Community}
                segments={
                  tool === ToolSlug.PhraseBackTranslate
                    ? NamedRegions.BackTranslation
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

export const PassageDetail = () => {
  const { prjId } = useParams();
  const { pathname } = useLocation();
  const setUrlContext = useUrlContext();
  const [view, setView] = useState('');
  const [projType] = useGlobal('projType'); //verified this is not used in a function 2/18/25
  const [user] = useGlobal('user');
  const { setProjectType } = useProjectType();

  useEffect(() => {
    const projectId = setUrlContext(prjId ?? '');
    if (user && projType === '') {
      const tmp = setProjectType(projectId);
      if (!tmp) {
        // If user is set but we don't have this project, go to the team screen
        setView('/team');
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (view !== '' && view !== pathname) return <StickyRedirect to={view} />;

  return (
    <Box
      sx={{
        flexGrow: 1,
        minWidth: 0,
        minHeight: '536px',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <AppHead switchTo={true} />
      <PassageDetailProvider>
        <PassageDetailGrids />
      </PassageDetailProvider>
    </Box>
  );
};
export default PassageDetail;
