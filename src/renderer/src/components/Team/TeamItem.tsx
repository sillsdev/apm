import React, { useContext, useState, useMemo } from 'react';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { Grid, IconButton } from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import { DialogMode, ICardsStrings, OrganizationD } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { cardsSelector } from '../../selector';
import { TeamContext } from '../../context/TeamContext';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { StepEditor } from '../StepEditor';
import GroupTabs from '../GroupTabs';
import { ProjectCard, AddCard } from '.';
import TeamDialog, { ITeamDialog } from './TeamDialog';
import { useRole, defaultWorkflow, useTeamWorkflowProcess } from '../../crud';
import Confirm from '../AlertDialog';
import { UnsavedContext } from '../../context/UnsavedContext';
import { TeamPaper, TeamHeadDiv, TeamName, Button } from '../../control';
import { RecordIdentity } from '@orbit/records';
import { ProjectSort } from './ProjectDialog/ProjectSort';
import SortIcon from '@mui/icons-material/Sort';
import { LocalKey, localUserKey } from '../../utils/localUserKey';
import { useCommitTeamSettings } from '../../crud/useCommitTeamSettings';

interface IProps {
  team: OrganizationD;
}

export const TeamItem = (props: IProps) => {
  const { team } = props;
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [connected] = useGlobal('connected');
  const [, setOrganization] = useGlobal('organization');
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [editOpen, setEditOpen] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RecordIdentity>();
  const ctx = React.useContext(TeamContext);
  const { teamProjects, teamMembers, teamDelete, isAdmin } = ctx.state;
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const [openMember, setOpenMember] = useState(false);
  const { setMyOrgRole, userIsOrgAdmin } = useRole();
  const teamWorkflow = useTeamWorkflowProcess(team.id);
  const stepEditorProcess = teamWorkflow ?? defaultWorkflow;
  const { startSave, waitForSave } = useContext(UnsavedContext).state;
  const [sortVisible, setSortVisible] = useState(false);
  const getGlobal = useGetGlobal();
  const commitTeamSettings = useCommitTeamSettings();
  const handleMembers = (team: OrganizationD) => () => {
    localStorage.setItem(localUserKey(LocalKey.team), team.id);
    setOrganization(team.id);
    setMyOrgRole(team.id);
    setOpenMember(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const userIsAdmin = useMemo(() => userIsOrgAdmin(team.id), [team]);

  const hasMoreThanOneProject = useMemo(
    () => teamProjects(team.id).length > 1,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team]
  );

  const handleSettings = () => () => {
    setEditOpen(true);
  };

  const handleCommitSettings = async (
    values: ITeamDialog,
    cb?: (id: string) => Promise<void>
  ) => {
    await commitTeamSettings(values, cb);
    setEditOpen(false);
  };

  const handleDeleteTeam = (team: RecordIdentity) => {
    setDeleteItem(team);
  };

  const handleDeleteConfirmed = async () => {
    deleteItem && (await teamDelete(deleteItem));
    setEditOpen(false);
  };

  const handleDeleteRefused = () => setDeleteItem(undefined);

  const handleWorkflow = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setShowWorkflow(isOpen), 500);
    } else setShowWorkflow(isOpen);
  };

  const handleEditWorkflow = () => {
    setShowWorkflow(true);
  };

  const canModify = useMemo(() => {
    return (!offline && connected && isAdmin(team)) || offlineOnly;
  }, [offline, team, offlineOnly, isAdmin, connected]);

  return (
    <TeamPaper id="TeamItem">
      <TeamHeadDiv>
        <Grid
          container
          direction={'row'}
          sx={{ justifyContent: 'space-between' }}
        >
          <Grid size={{ xs: 12, md: 4, lg: 7, xl: 8 }}>
            <TeamName variant="h5">
              <GroupIcon sx={{ pr: 1 }} />
              {team?.attributes?.name}
            </TeamName>
          </Grid>
          <Grid
            size={{ xs: 12, md: 8, lg: 5, xl: 4 }}
            sx={{ display: 'flex', justifyContent: 'flex-end' }}
          >
            {userIsAdmin && hasMoreThanOneProject && canModify && (
              <IconButton onClick={() => setSortVisible(true)}>
                <SortIcon />
              </IconButton>
            )}
            <Button
              id="teamMembers"
              variant="contained"
              color="secondary"
              onClick={handleMembers(team)}
            >
              {t.members.replace('{0}', teamMembers(team.id).toString())}
            </Button>
            {canModify && (
              <Button
                id="editWorkflow"
                variant="contained"
                color="secondary"
                onClick={handleEditWorkflow}
                disabled={busy}
              >
                {t.editWorkflow.replace('{0}', '')}
              </Button>
            )}
            {canModify && (
              <Button
                id="teamSettings"
                variant="contained"
                color="secondary"
                onClick={handleSettings()}
                disabled={busy}
              >
                {t.settings}
              </Button>
            )}
          </Grid>
        </Grid>
      </TeamHeadDiv>
      {editOpen && (
        <TeamDialog
          mode={DialogMode.edit}
          values={{ team } as ITeamDialog}
          isOpen={editOpen}
          onOpen={setEditOpen}
          onCommit={handleCommitSettings}
          onDelete={handleDeleteTeam}
        />
      )}
      <BigDialog
        title={t.members.replace('{0}', team?.attributes?.name || '')}
        isOpen={openMember}
        onOpen={setOpenMember}
        bp={BigDialogBp.md}
      >
        <GroupTabs />
      </BigDialog>
      <BigDialog
        title={t.editWorkflow.replace(
          '{0}',
          `- ${team?.attributes?.name || ''}`
        )}
        isOpen={showWorkflow}
        onOpen={handleWorkflow}
      >
        <StepEditor process={stepEditorProcess} org={team.id} />
      </BigDialog>
      <BigDialog
        title={t.sortProjects}
        isOpen={sortVisible}
        onOpen={() => setSortVisible(false)}
      >
        <ProjectSort teamId={team.id} onClose={() => setSortVisible(false)} />
      </BigDialog>
      {deleteItem && (
        <Confirm
          text={''}
          yesResponse={handleDeleteConfirmed}
          noResponse={handleDeleteRefused}
        />
      )}
      <Grid container sx={{ px: 2 }}>
        {teamProjects(team.id).map((i) => {
          return <ProjectCard key={i.id} project={i} />;
        })}
        {canModify && <AddCard team={team} />}
      </Grid>
    </TeamPaper>
  );
};
