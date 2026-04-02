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
import { ToolSlug, useProjectType, useStepTool, useUrlContext } from '../crud';
import PassageDetailGrids from '../components/PassageDetail/PassageDetailGrids';
import { useMobile } from '../utils/useMobile';
import PassageDetailMobileDetail from '../components/PassageDetail/PassageDetailMobileDetail';
import { ISharedStrings } from '@model/index';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import PassageDetailRecord from '../components/PassageDetail/PassageDetailRecord';
import { usePaneWidth } from '../components/usePaneWidth';
import { HeadHeight } from '../App';

const NotImplemented = () => 'Not implemented';

const MobileStep = () => {
  const { currentstep } = useContext(PassageDetailContext)?.state ?? {
    currentstep: '',
  };
  const { tool } = useStepTool(currentstep);
  const { paneWidth } = usePaneWidth();

  return tool === ToolSlug.Record ? (
    <PassageDetailRecord width={Math.max(0, paneWidth - 40)} />
  ) : (
    <NotImplemented />
  );
};

const MobileDetail = () => {
  const { isMobileWidth } = useMobile();
  const { discussOpen, rowData } = useContext(PassageDetailContext)?.state ?? {
    discussOpen: false,
    rowData: [],
  };
  const currentVersion = useMemo(() => rowData[0]?.version ?? 0, [rowData]);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const showSideBySide = useMemo(() => !isMobileWidth, [isMobileWidth]);
  const flushDiscussionLeft = useMemo(
    () => discussOpen && !showSideBySide,
    [discussOpen, showSideBySide]
  );

  return (
    <PassageDetailMobileDetail
      currentVersion={currentVersion}
      showSideBySide={showSideBySide}
      flushDiscussionLeft={flushDiscussionLeft}
      recordContent={!discussOpen || showSideBySide ? <MobileStep /> : null}
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
              // otherwise mobile layout height calc(100vh - HeadHeight) leaves a gap at the bottom.
              pt: `${HeadHeight}px`,
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
