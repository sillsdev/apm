import { useContext, useEffect, useMemo, useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useLocation, useParams } from 'react-router-dom';
import { Box } from '@mui/material';

import AppHead from '../components/App/AppHead';
import {
  PassageDetailContext,
  PassageDetailProvider,
} from '../context/PassageDetailContext';
import StickyRedirect from '../components/StickyRedirect';
import {
  ToolSlug,
  toolAllowsEmptyVernacularAudio,
  useProjectType,
  useStepTool,
  useUrlContext,
  useArtifactType,
  remoteIdGuid,
} from '../crud';
import PassageDetailGrids from '../components/PassageDetail/PassageDetailGrids';
import { useMobile } from '../utils/useMobile';
import PassageDetailMobileDetail from '../components/PassageDetail/PassageDetailMobileDetail';
import { ISharedStrings } from '@model/index';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import PassageDetailRecord from '../components/PassageDetail/PassageDetailRecord';
import { usePaneWidth } from '../components/usePaneWidth';
import { HeadHeight } from '../layout';
import { RecordKeyMap } from '@orbit/records';
import PassageDetailsArtifactsMobile from '../components/PassageDetail/Internalization/PassageDetailsArtifactsMobile';
import PassageDetailMarkVerses from '../components/PassageDetail/mobile/MarkVerses/PassageDetailMarkVerses';
import PassageDetailCarefulSpeech from '../components/PassageDetail/PassageDetailCarefulSpeech';
import PassageDetailPhraseBackTranslate from '../components/PassageDetail/PassageDetailPhraseBackTranslate';
import PassageDetailLwcTranslation from '../components/PassageDetail/PassageDetailLwcTranslation';
import PassageDetailLwcTranscription from '../components/PassageDetail/PassageDetailLwcTranscription';
import { isBoldClauseTranscriptionStep } from '../components/PassageDetail/boldClauseTranscription';
import TeamCheckReferenceMobile from '../components/PassageDetail/mobile/TeamCheckReferenceMobile';
import PassageDetailPrompt from '../components/PassageDetail/Prompt/PassageDetailPrompt';

const NotImplemented = () => 'Not implemented';

const MobileStep = () => {
  const { currentstep, isBoldWorkflow } = useContext(PassageDetailContext)
    ?.state ?? {
    currentstep: '',
    isBoldWorkflow: false,
  };
  const { tool, settings } = useStepTool(currentstep);
  const [memory] = useGlobal('memory');
  const { slugFromId } = useArtifactType();
  const { paneWidth } = usePaneWidth();

const artifactSlug = useMemo(() => {
  const parsed =
    typeof settings === 'string'
      ? (() => {
          try {
            return JSON.parse(settings || '{}') as { artifactTypeId?: string };
          } catch {
            return {} as { artifactTypeId?: string };
          }
        })()
      : ((settings as { artifactTypeId?: string }) ?? {});
    const id = parsed?.artifactTypeId;
    if (!id) return null;
    const resolved =
      remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id;
    return slugFromId(resolved);
  }, [settings, memory?.keyMap, slugFromId]);

  const boldClauseTranscription = isBoldClauseTranscriptionStep(
    tool ?? '',
    isBoldWorkflow,
    artifactSlug
  );

  return tool === ToolSlug.Record ? (
    <PassageDetailRecord width={Math.max(0, paneWidth - 40)} />
  ) : tool === ToolSlug.Resource ? (
    <PassageDetailsArtifactsMobile />
  ) : tool === ToolSlug.Verses ? (
    <PassageDetailMarkVerses width={Math.max(0, paneWidth - 40)} />
  ) : tool === ToolSlug.CarefulSpeech ? (
    <PassageDetailCarefulSpeech width={Math.max(0, paneWidth - 40)} />
  ) : tool === ToolSlug.PhraseBackTranslate && isBoldWorkflow ? (
    <PassageDetailLwcTranslation width={Math.max(0, paneWidth - 40)} />
  ) : tool === ToolSlug.PhraseBackTranslate && !isBoldWorkflow ? (
    <PassageDetailPhraseBackTranslate width={Math.max(0, paneWidth - 40)} />
  ) : boldClauseTranscription ? (
    // Key on currentstep so the shared transcription component remounts when
    // moving between the adjacent Careful- and LWC-Transcription steps. Desktop
    // gets this for free via <Paper key={currentstep}> in PassageDetailGrids;
    // without it here the reused instance carries state (and flushes the prior
    // step's text onto the new step's artifact), so LWC shows Careful's
    // transcriptions. (TT-7503)
    <PassageDetailLwcTranscription
      key={currentstep}
      width={Math.max(0, paneWidth - 40)}
    />
  ) : tool === ToolSlug.TeamCheck ? (
    <TeamCheckReferenceMobile width={Math.max(0, paneWidth - 40)} />
  ) : tool === ToolSlug.Prompt ? (
    <PassageDetailPrompt width={Math.max(0, paneWidth - 40)} />
  ) : (
    <NotImplemented />
  );
};

const MobileDetail = () => {
  const { isMobileWidth } = useMobile();
  const { discussOpen, rowData, currentstep } = useContext(PassageDetailContext)
    ?.state ?? {
    discussOpen: false,
    rowData: [],
    currentstep: '',
  };
  const { tool } = useStepTool(currentstep);
  const currentVersion = useMemo(() => rowData[0]?.version ?? 0, [rowData]);
  /** Policy lives here (with step tool); the layout component only branches on the result. */
  const showNoAudioPlaceholder = useMemo(
    () => currentVersion === 0 && !toolAllowsEmptyVernacularAudio(tool),
    [currentVersion, tool]
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const showSideBySide = useMemo(() => !isMobileWidth, [isMobileWidth]);
  const flushDiscussionLeft = useMemo(
    () => discussOpen && !showSideBySide,
    [discussOpen, showSideBySide]
  );

  return (
    <PassageDetailMobileDetail
      showNoAudioPlaceholder={showNoAudioPlaceholder}
      showSideBySide={showSideBySide}
      flushDiscussionLeft={flushDiscussionLeft}
      // Always mount MobileStep on narrow mobile while discussion is open; unmounting
      // drops PassageDetailRecord/MediaRecord state and clears an in-progress recording.
      recordContent={<MobileStep />}
      noAudioText={ts.noAudio}
    />
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
  const { isMobile } = useMobile();

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

  // Lock document scroll on mobile so only the inner content region scrolls;
  // this prevents MobileWorkflowSteps being scrolled under the AppBar.
  useEffect(() => {
    if (!isMobile) return;
    const { body } = document;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [isMobile]);

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
        {isMobile ? (
          <Box
            sx={{
              // AppHead is position:fixed — offset in-flow content like PassageDetailGrids does,
              // otherwise mobile layout height calc(100dvh - HeadHeight) leaves a gap at the bottom.
              pt: `${HeadHeight}px`,
              backgroundColor: 'custom.headerBackground',
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MobileDetail />
          </Box>
        ) : (
          <PassageDetailGrids />
        )}
      </PassageDetailProvider>
    </Box>
  );
};
export default PassageDetail;
