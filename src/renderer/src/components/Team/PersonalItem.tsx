import { useState, useContext, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SortIcon from '@mui/icons-material/Sort';
import { ICardsStrings, OrganizationD } from '../../model';
import DialogMode from '../../model/dialogMode';
import { cardsSelector } from '../../selector';
import { TeamContext } from '../../context/TeamContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { defaultWorkflow, useBible } from '../../crud';
import BigDialog from '../../hoc/BigDialog';
import { useOrbitData } from '../../hoc/useOrbitData';
import { Button } from '../../control';
import { StepEditor } from '../StepEditor';
import { ProjectCard, AddCard, TeamDialog, ITeamDialog } from '.';
import { ProjectSort } from './ProjectDialog/ProjectSort';
import TeamPanel from './TeamPanel';

export const PersonalItem = () => {
  const ctx = useContext(TeamContext);
  const { personalTeam, personalProjects, teamUpdate } = ctx.state;
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [connected] = useGlobal('connected');
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const orgs = useOrbitData<OrganizationD[]>('organization');
  const getGlobal = useGetGlobal();
  const [editOpen, setEditOpen] = useState(false);
  const { createBible, updateBible } = useBible();
  const { startSave, waitForSave } = useContext(UnsavedContext).state;
  const [sortVisible, setSortVisible] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const handleSettings = () => {
    setEditOpen(true);
  };

  const team = useMemo(
    () => orgs.find((o) => o.id === personalTeam),
    [personalTeam, orgs]
  );

  const handleCommitSettings = async (
    values: ITeamDialog,
    cb?: (id: string) => Promise<void>
  ) => {
    if (values.bible)
      if (!values.bible.id) {
        await createBible(
          values.bible,
          values.bibleMediafile,
          values.isoMediafile,
          values.team.id
        );
      } else
        await updateBible(
          values.bible,
          values.bibleMediafile,
          values.isoMediafile,
          values.team.id
        );

    teamUpdate(values.team);

    cb && (await cb(values.team.id));
    setEditOpen(false);
  };

  const handleWorkflow = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setShowWorkflow(isOpen), 500);
    } else setShowWorkflow(isOpen);
  };

  const handleEditWorkflow = () => {
    setShowWorkflow(true);
  };
  const canModify = (offline: boolean, offlineOnly: boolean, online: boolean) =>
    (!offline && online) || offlineOnly;

  return (
    <>
      <TeamPanel
        id="PersonalItem"
        icon={<PersonIcon />}
        title={t.personalProjects}
        actions={
          <>
            {personalProjects.length > 1 &&
              canModify(isOffline, offlineOnly, connected) && (
                <IconButton onClick={() => setSortVisible(true)}>
                  <SortIcon />
                </IconButton>
              )}
            {canModify(isOffline, offlineOnly, connected) && (
              <Button id="editWorkflow" onClick={handleEditWorkflow}>
                {t.editWorkflow.replace('{0}', '')}
              </Button>
            )}
            {canModify(isOffline, offlineOnly, connected) && (
              <Button
                id="teamSettings"
                onClick={handleSettings}
                disabled={busy}
              >
                {t.settings}
              </Button>
            )}
          </>
        }
      >
        {personalProjects.map((i) => {
          return <ProjectCard key={i.id} project={i} />;
        })}
        {(!isOffline || offlineOnly) && <AddCard team={null} />}
      </TeamPanel>
      <BigDialog
        title={t.editWorkflow.replace('{0}', `- ${t.personalProjects}`)}
        isOpen={showWorkflow}
        onOpen={handleWorkflow}
      >
        <StepEditor process={defaultWorkflow} org={personalTeam} />
      </BigDialog>
      <BigDialog
        title={t.sortProjects}
        isOpen={sortVisible}
        onOpen={() => setSortVisible(false)}
      >
        <ProjectSort onClose={() => setSortVisible(false)} />
      </BigDialog>
      {editOpen && (
        <TeamDialog
          mode={DialogMode.edit}
          values={{ team } as ITeamDialog}
          isOpen={editOpen}
          onOpen={setEditOpen}
          onCommit={handleCommitSettings}
        />
      )}
    </>
  );
};
export default PersonalItem;
