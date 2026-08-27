import React, { useEffect } from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { useParams } from 'react-router-dom';
import {
  IPlanTabsStrings,
  Plan,
  Section,
  Passage,
  flatScrColNames,
  flatGenColNames,
  levScrColNames,
  levGenColNames,
  MediaFileD,
} from '../model';
import { Tabs, Tab, Box } from '@mui/material';
import ScriptureTable from './Sheet/ScriptureTable';
import AudioTab from '../components/AudioTab/AudioTab';
import AssignmentTable from './AssignmentTable';
import TranscriptionTab from './TranscriptionTab';
import StickyRedirect from './StickyRedirect';
import { PlanContext } from '../context/PlanContext';
import {
  useOrganizedBy,
  useMediaCounts,
  useSectionCounts,
  useShowAssignment,
} from '../crud';
import { useMobile } from '../utils';
import { useOrbitData } from '../hoc/useOrbitData';
import { shallowEqual, useSelector } from 'react-redux';
import { planTabsSelector } from '../selector';
import { PlanTabEnum } from './PlanTabsEnum';
import { grey } from '@mui/material/colors';
import ContentLayout from './App/ContentLayout';

interface IProps {
  checkSaved: (method: () => void) => void;
}
const ScrollableTabsButtonAuto = (props: IProps) => {
  const { checkSaved } = props;
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const plans = useOrbitData<Plan[]>('plan');
  const sections = useOrbitData<Section[]>('section');
  const passages = useOrbitData<Passage[]>('passage');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const ctx = React.useContext(PlanContext);
  const { flat, scripture, sectionArr, tab, setTab } = ctx.state;
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [plan] = useGlobal('plan'); //will be constant here
  const { isMobile } = useMobile();
  const getGlobal = useGetGlobal();
  const { prjId, tabNm } = useParams();
  const { getOrganizedBy } = useOrganizedBy();
  const [planMedia, attached, trans] = useMediaCounts(plan, mediafiles);
  const [planSectionIds, assigned, planPassages] = useSectionCounts(
    plan,
    sections,
    passages
  );
  const showAssign = useShowAssignment();

  const colNames = React.useMemo(() => {
    return scripture && flat
      ? flatScrColNames
      : scripture && !flat
        ? levScrColNames
        : flat
          ? flatGenColNames
          : levGenColNames;
  }, [scripture, flat]);

  const handleChange = (event: any, value: number) => {
    if (getGlobal('remoteBusy')) return;
    setTab(value);
  };
  const organizedBy = getOrganizedBy(false);

  interface ITitle {
    text: string;
    status: string;
  }
  const Title = ({ text, status }: ITitle) => {
    return (
      <>
        {text}
        <Box sx={{ fontSize: 'x-small', color: grey[400] }}>{status}</Box>
      </>
    );
  };

  const statusMessage = (msg: string, val1: number, val2: number) =>
    msg.replace('{1}', val1.toString()).replace('{2}', val2.toString());

  useEffect(() => {
    if (tab === undefined) {
      setTab(tabNm && /^[0-4]+$/.test(tabNm) ? parseInt(tabNm) : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tab !== undefined && tab.toString() !== tabNm)
    return <StickyRedirect to={`/plan/${prjId}/${tab}`} />;

  if (isMobile && tab === PlanTabEnum.sectionPassage)
    return <ScriptureTable {...props} colNames={colNames} />;
  if (isMobile && showAssign && tab === PlanTabEnum.assignment)
    return <AssignmentTable />;

  return (
    <ContentLayout
      header={
        <Tabs
          value={tab ?? 0}
          onChange={(e: any, v: number) => checkSaved(() => handleChange(e, v))}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            id="secPass"
            label={
              flat
                ? organizedBy
                : t.sectionsPassages.replace('{0}', organizedBy)
            }
          />
          <Tab
            id="audio"
            label={
              <Title
                text={t.media}
                status={statusMessage(
                  t.mediaStatus,
                  (attached ?? []).length,
                  (planMedia ?? []).length
                )}
              />
            }
          />
          {showAssign && (
            <Tab
              id="assignments"
              label={
                <Title
                  text={t.assignments}
                  status={statusMessage(
                    t.sectionStatus.replace('{0}', organizedBy),
                    (assigned ?? []).length,
                    (planSectionIds ?? []).length
                  )}
                />
              }
              disabled={isOffline}
            />
          )}
          <Tab
            id="transcriptions"
            label={
              <Title
                text={t.transcriptions}
                status={statusMessage(
                  t.passageStatus,
                  (trans ?? []).length,
                  (planPassages ?? []).length
                )}
              />
            }
          />
        </Tabs>
      }
    >
      <Box
        sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        {tab === PlanTabEnum.sectionPassage && (
          <ScriptureTable {...props} colNames={colNames} />
        )}
        {tab === PlanTabEnum.media && <AudioTab />}
        {showAssign && tab === PlanTabEnum.assignment && <AssignmentTable />}
        {(tab === PlanTabEnum.transcription ||
          (!showAssign && tab === PlanTabEnum.assignment)) && (
          <TranscriptionTab
            {...props}
            projectPlans={plans.filter((p) => p.id === plan)}
            sectionArr={sectionArr}
            planColumn={true}
          />
        )}
      </Box>
    </ContentLayout>
  );
};

export default ScrollableTabsButtonAuto;
