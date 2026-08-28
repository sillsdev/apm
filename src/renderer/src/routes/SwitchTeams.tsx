import React, { useState, useContext, useEffect, useMemo } from 'react';
import { RecordIdentity } from '@orbit/records';
import {
  Box,
  Card,
  CardActionArea,
  IconButton,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import { DialogMode } from '../model';
import { Button, columnSx, rowSx, spreadSx } from '../control';
import { BigDialogBp } from '../hoc/BigDialogBp';
import { TeamProvider, TeamContext } from '../context/TeamContext';
import { useGlobal } from '../context/useGlobal';
import AppLayout from '../components/App/AppLayout';
import ContentLayout from '../components/App/ContentLayout';
import ImportTab from '../components/ImportTab';
import StickyRedirect from '../components/StickyRedirect';
import { SharedContentCreatorDialog } from '../components/Team/SharedContentCreatorDialog';
import TeamDialog, { ITeamDialog } from '../components/Team/TeamDialog';
import { useTeamActions } from '../components/Team/useTeamActions';
import { LocalKey, localUserKey, useMobile, useMyNavigate } from '../utils';
import { useIsPapLike } from '../utils/useIsPapLike';

interface ITeamCardProps {
  label: string;
  teamId: string;
  name: string;
  onOpenSettings: () => void;
}

const TeamCard = ({ label, teamId, name, onOpenSettings }: ITeamCardProps) => {
  const ctx = useContext(TeamContext);
  const { isAdmin, teams, personalTeam } = ctx.state;
  const { isMobileWidth } = useMobile();
  const navigate = useMyNavigate();
  const [offline] = useGlobal('offline');
  const [connected] = useGlobal('connected');
  const [offlineOnly] = useGlobal('offlineOnly');

  const teamRec = teams.find((tm) => tm.id === teamId);
  const isPersonalTeam = teamId === personalTeam;
  const showSettings =
    (isPersonalTeam || (teamRec && isAdmin(teamRec))) &&
    ((!offline && connected) || offlineOnly) &&
    !isMobileWidth;

  return (
    <Card
      data-testid={label + '-row'}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        height: '100%',
        bgcolor: 'primary.light',
        color: 'primary.contrastText',
      }}
    >
      <CardActionArea
        onClick={() => {
          localStorage.setItem(localUserKey(LocalKey.team), teamId);
          navigate('/team');
        }}
        sx={{ p: 1.5 }}
      >
        <Box sx={{ mr: showSettings ? '30px' : 0 }}>
          <Typography noWrap>{name}</Typography>
        </Box>
      </CardActionArea>
      {showSettings && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: 1,
            transform: 'translateY(-50%)',
          }}
        >
          <IconButton
            size="small"
            aria-label={label + ' settings'}
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            data-testid={label + '-settings'}
            color="inherit"
          >
            <SettingsIcon sx={{ p: 0.5 }} />
          </IconButton>
        </Box>
      )}
    </Card>
  );
};

interface ITeamSectionProps {
  icon: React.ReactNode;
  title: string;
  testId: string;
  children: React.ReactNode;
}

const TeamSection = ({ icon, title, testId, children }: ITeamSectionProps) => {
  return (
    <Box data-testid={testId} sx={columnSx}>
      <Box sx={[rowSx, { alignItems: 'center' }]}>
        <Box sx={{ display: 'flex', py: 1, color: 'custom.black' }}>{icon}</Box>
        <Typography noWrap sx={{ fontSize: 'large' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={columnSx}>{children}</Box>
    </Box>
  );
};

/**
 * Team picker screen.
 *
 * Work Alone / PAP-like users have only a personal team, so there is nothing to
 * pick: they are redirected to team home before the picker renders.
 */
export const SwitchTeamsInner = () => {
  const theme = useTheme();
  const isPapLike = useIsPapLike();
  const ctx = useContext(TeamContext);
  const { teams, personalTeam, teamUpdate, teamDelete } = ctx.state;
  const {
    t,
    offline,
    connected,
    isDeveloper,
    userIsSharedContentAdmin,
    isDeleting,
    navigate,
    openAdd,
    importOpen,
    setImportOpen,
    openContent,
    email,
    validEmail,
    contentStatus,
    handleAddClick,
    handleImportClick,
    handleContentClick,
    handleAdded,
    handleContentDone,
    handleAddCommit,
    handleEmailChange,
    handleSharedContentClick,
  } = useTeamActions();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTeamId, setSettingsTeamId] = useState<string | undefined>();

  const selectedTeam = useMemo(() => {
    if (!settingsTeamId) return undefined;
    const org = (teams || []).find((o) => o.id === settingsTeamId);
    if (org) return org;
    if (settingsTeamId === personalTeam)
      return {
        id: personalTeam,
        type: 'organization',
        attributes: { name: 'Personal' },
      } as any;
    return undefined;
  }, [settingsTeamId, teams, personalTeam]);

  const openSettingsForTeam = (id: string) => {
    setSettingsTeamId(id);
    setSettingsOpen(true);
  };
  const openSettingsForPersonal = () => {
    setSettingsTeamId(personalTeam);
    setSettingsOpen(true);
  };
  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };
  const handleSettingsCommit = (value: ITeamDialog) => {
    teamUpdate(value.team as any);
    handleSettingsClose();
  };
  const handleSettingsDelete = async (team: RecordIdentity) => {
    await teamDelete(team);
    handleSettingsClose();
  };
  const isPersonalSettings = settingsTeamId === personalTeam;

  useEffect(() => {
    if (!isPapLike || !personalTeam) return;
    const key = localUserKey(LocalKey.team);
    if (localStorage.getItem(key) !== personalTeam) {
      localStorage.setItem(key, personalTeam);
    }
  }, [isPapLike, personalTeam]);

  if (!personalTeam) {
    return null;
  }

  if (isPapLike) {
    return <StickyRedirect to="/team" />;
  }

  return (
    <>
      <ContentLayout
        header={
          <Box sx={spreadSx}>
            <Box sx={rowSx}>
              {!offline && connected && (
                <Button
                  id="TeamActAdd"
                  data-testid="add-team-button"
                  onClick={handleAddClick}
                >
                  {t.addTeam}
                </Button>
              )}
            </Box>
            <Box sx={rowSx}>
              <Button
                id="teamActImport"
                data-testid="import-button"
                onClick={handleImportClick}
              >
                {t.import}
              </Button>
              {!offline && userIsSharedContentAdmin && (
                <Button
                  id="contentCreator"
                  disableTypography
                  onClick={handleContentClick}
                >
                  <AddIcon fontSize="small" />
                </Button>
              )}
              {isDeveloper && (
                <Button id="Error" onClick={() => navigate('/error')}>
                  Error
                </Button>
              )}
            </Box>
          </Box>
        }
        drawBottomBorder
        contentSx={{ p: theme.layout.gap }}
      >
        <Box
          id="TeamsScreen"
          sx={{
            width: '100%',
            maxWidth: 'sm',
            mx: 'auto',
          }}
        >
          <Box sx={[columnSx, { p: theme.layout.p }]}>
            <TeamSection
              icon={<PersonIcon />}
              title={t?.personal}
              testId="personal-section"
            >
              <TeamCard
                label="personal"
                teamId={personalTeam}
                name={t?.personalProjects}
                onOpenSettings={openSettingsForPersonal}
              />
            </TeamSection>
            <TeamSection
              icon={<GroupIcon />}
              title={t?.teams}
              testId="teams-section"
            >
              {teams.map((tm) => (
                <TeamCard
                  key={tm.id}
                  label="team"
                  teamId={tm.id}
                  name={tm.attributes?.name}
                  onOpenSettings={() => openSettingsForTeam(tm.id)}
                />
              ))}
            </TeamSection>
          </Box>
        </Box>
      </ContentLayout>
      {selectedTeam && (
        <TeamDialog
          mode={DialogMode.edit}
          isOpen={settingsOpen}
          onOpen={handleSettingsClose}
          onCommit={(v) => handleSettingsCommit(v)}
          values={{ team: selectedTeam } as any}
          disabled={isDeleting}
          {...(!isPersonalSettings ? { onDelete: handleSettingsDelete } : {})}
        />
      )}
      <TeamDialog
        mode={DialogMode.add}
        isOpen={openAdd}
        onOpen={handleAdded}
        onCommit={handleAddCommit}
        disabled={isDeleting}
      />
      <SharedContentCreatorDialog
        isOpen={openContent}
        onOpen={handleContentDone}
        onSave={validEmail ? handleSharedContentClick : undefined}
        onCancel={handleContentDone}
        title={t.creatorAdd}
        creatorEmail={t.creatorEmail}
        bp={BigDialogBp.mobile}
        email={email}
        onEmailChange={handleEmailChange}
        validEmail={validEmail}
        contentStatus={contentStatus}
      />
      {importOpen && (
        <ImportTab
          isOpen={importOpen}
          onOpen={setImportOpen}
          offerPtf={!offline}
        />
      )}
    </>
  );
};

export const SwitchTeams = () => {
  return (
    <TeamProvider>
      <AppLayout appHeadProps={{ drawBottomBorder: false }}>
        <SwitchTeamsInner />
      </AppLayout>
    </TeamProvider>
  );
};

export default SwitchTeams;
