import React from 'react';
import { RecordIdentity } from '@orbit/records';
import {
  Box,
  Card,
  Stack,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import { DialogMode, ICardsStrings } from '../model';
import { shallowEqual, useSelector } from 'react-redux';
import { cardsSelector } from '../selector';
import TeamDialog, { ITeamDialog } from '../components/Team/TeamDialog';
import { useMyNavigate } from '../utils/useMyNavigate';
import { LocalKey, localUserKey, useMobile } from '../utils';
import { BigDialogBp } from '../hoc/BigDialogBp';
import ImportTab from '../components/ImportTab';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import AppLayout from '../components/App/AppLayout';
import { useTheme, alpha } from '@mui/material/styles';
import { TeamProvider } from '../context/TeamContext';
import { TeamContext } from '../context/TeamContext';
import { useGlobal } from '../context/useGlobal';
import { useTeamActions } from '../components/Team/useTeamActions';
import { SharedContentCreatorDialog } from '../components/Team/SharedContentCreatorDialog';
import StickyRedirect from '../components/StickyRedirect';
import { useIsPapLike } from '../utils/useIsPapLike';

interface ISettingsButtonProps {
  label: string;
  onOpenSettings: () => void;
}

const SettingsButton = ({ label, onOpenSettings }: ISettingsButtonProps) => {
  const theme = useTheme();
  const bgColor = theme.palette.primary.light;
  const contrastColor = theme.palette.getContrastText(bgColor);
  const { isMobile } = useMobile();

  return (
    <IconButton
      size="small"
      aria-label={label + ' settings'}
      onClick={(e) => {
        e.stopPropagation();
        onOpenSettings();
      }}
      sx={(theme) => ({
        color: isMobile ? 'inherit' : theme.palette.primary.light,
        transition: 'background-color .2s, color .2s',
        '&:hover': {
          color: contrastColor,
          backgroundColor: alpha(theme.palette.common.white, 0.25),
        },
        '&:focus-visible': {
          color: contrastColor,
          backgroundColor: alpha(theme.palette.common.white, 0.4),
        },
      })}
      data-testid={label + '-settings'}
    >
      <SettingsIcon fontSize="small" />
    </IconButton>
  );
};

interface ITeamCardProps {
  label: string;
  teamId: string;
  name: string;
  onOpenSettings: () => void;
}
const TeamCard = ({ label, teamId, name, onOpenSettings }: ITeamCardProps) => {
  const theme = useTheme();
  const bgColor = theme.palette.primary.light;
  const contrastColor = theme.palette.getContrastText(bgColor);
  const navigate = useMyNavigate();
  const ctx = React.useContext(TeamContext);
  const { isAdmin, teams, personalTeam } = ctx.state;
  const teamRec = teams.find((t) => t.id === teamId);
  const { isMobile } = useMobile();
  const [isOffline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [connected] = useGlobal('connected');
  // Personal teams are always eligible for settings; other teams require admin access.
  // The button is only rendered when team settings can be modified in the current
  // connectivity mode (online, or offlineOnly).
  const isPersonalTeam = teamId === personalTeam;
  const showSettings = isPersonalTeam || (teamRec && isAdmin(teamRec));
  const canModifyTeamSettings = (!isOffline && connected) || offlineOnly;

  return (
    <Card
      sx={{ bgcolor: bgColor, color: contrastColor, p: 0 }}
      elevation={1}
      data-testid={label + '-row'}
      onClick={() => {
        localStorage.setItem(localUserKey(LocalKey.team), teamId);
        navigate('/team');
      }}
      style={{ cursor: 'pointer' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 56,
          px: 2,
        }}
      >
        <Typography
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {name}
        </Typography>
        {showSettings && !isMobile && canModifyTeamSettings && (
          <SettingsButton label={label} onOpenSettings={onOpenSettings} />
        )}
      </Box>
    </Card>
  );
};

interface IPersonalSectionProps {
  onOpenSettings: () => void;
}
const PersonalSection = ({ onOpenSettings }: IPersonalSectionProps) => {
  const ctx = React.useContext(TeamContext);
  const { personalTeam } = ctx.state;
  const cardStrings: ICardsStrings = useSelector(cardsSelector, shallowEqual);

  return (
    <Stack spacing={1} data-testid="personal-section">
      <Typography variant="h6">
        {cardStrings?.personal || 'Personal'}
      </Typography>
      <TeamCard
        label="personal"
        teamId={personalTeam}
        name={cardStrings?.personalProjects || 'Personal Audio Projects'}
        onOpenSettings={onOpenSettings}
      />
    </Stack>
  );
};

interface ITeamsSectionProps {
  onOpenSettings: (teamId: string) => void;
}
const TeamsSection = ({ onOpenSettings }: ITeamsSectionProps) => {
  const ctx = React.useContext(TeamContext);
  const { teams } = ctx.state;
  const cardStrings: ICardsStrings = useSelector(cardsSelector, shallowEqual);

  return (
    <Stack spacing={1} data-testid="teams-section">
      <Typography variant="h6">{cardStrings?.teams || 'Teams'}</Typography>
      <Stack spacing={1}>
        {teams.map((t) => (
          <TeamCard
            key={t.id}
            label="team"
            teamId={t.id}
            name={t.attributes?.name || 'Unnamed Team'}
            onOpenSettings={() => onOpenSettings(t.id)}
          />
        ))}
      </Stack>
    </Stack>
  );
};

// Floating actions cluster: Add Team, Import, Shared Content Creator, Error (developer)
const FloatingActions = () => {
  const {
    t,
    offline,
    connected,
    offlineOnly,
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

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 32,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ pointerEvents: 'auto', alignItems: 'center' }}
        >
          <Box
            sx={{
              display: 'inline-grid',
              gridAutoFlow: 'column',
              gridAutoColumns: '1fr',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {!offline && connected && (
              <Button
                id="TeamActAdd"
                data-testid="add-team-button"
                variant="outlined"
                onClick={handleAddClick}
                sx={(theme) => ({
                  bgcolor: theme.palette.common.white,
                })}
              >
                {t.addTeam}
              </Button>
            )}
            <Button
              id="teamActImport"
              data-testid="import-button"
              variant="outlined"
              onClick={handleImportClick}
              sx={(theme) => ({
                bgcolor: theme.palette.common.white,
              })}
            >
              {t.import}
            </Button>
          </Box>
          {!offline && userIsSharedContentAdmin && (
            <Button
              id="contentCreator"
              variant="outlined"
              onClick={handleContentClick}
              sx={(theme) => ({
                minWidth: 48,
                px: 1,
                bgcolor: theme.palette.common.white,
              })}
            >
              <AddIcon fontSize="small" />
            </Button>
          )}
          {isDeveloper && (
            <Button
              id="Error"
              variant="outlined"
              onClick={() => navigate('/error')}
              sx={(theme) => ({
                minWidth: 80,
                bgcolor: theme.palette.common.white,
              })}
            >
              Error
            </Button>
          )}
        </Stack>
      </Box>

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

// Settings context to expose open handlers
interface ISettingsHandlers {
  openSettingsForTeam: (id: string) => void;
  openSettingsForPersonal: () => void;
}
const SettingsHandlersContext = React.createContext<
  ISettingsHandlers | undefined
>(undefined);

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ctx = React.useContext(TeamContext);
  const { teamUpdate, teamDelete, personalTeam, isDeleting } = ctx.state;
  const [open, setOpen] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string | undefined>();

  const selectedTeam = React.useMemo(() => {
    if (!teamId) return undefined;
    const organizations = ctx.state.teams || [];
    const org = organizations.find((o) => o.id === teamId);
    if (org) return org;
    if (teamId === personalTeam)
      return {
        id: personalTeam,
        type: 'organization',
        attributes: { name: 'Personal' },
      } as any;
    return undefined;
  }, [teamId, ctx.state.teams, personalTeam]);

  const openSettingsForTeam = (id: string) => {
    setTeamId(id);
    setOpen(true);
  };
  const openSettingsForPersonal = () => {
    setTeamId(personalTeam);
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleCommit = (value: ITeamDialog) => {
    teamUpdate(value.team as any);
    handleClose();
  };
  const handleDelete = async (team: RecordIdentity) => {
    await teamDelete(team);
    handleClose();
  };
  const isPersonal = teamId === personalTeam;

  return (
    <SettingsHandlersContext.Provider
      value={{ openSettingsForTeam, openSettingsForPersonal }}
    >
      {selectedTeam && (
        <TeamDialog
          mode={DialogMode.edit}
          isOpen={open}
          onOpen={handleClose}
          onCommit={(v) => handleCommit(v)}
          values={{ team: selectedTeam } as any}
          disabled={isDeleting}
          {...(!isPersonal ? { onDelete: handleDelete } : {})}
        />
      )}
      {children}
    </SettingsHandlersContext.Provider>
  );
};

const useSettingsHandlers = () => {
  const ctx = React.useContext(SettingsHandlersContext);
  if (!ctx) throw new Error('SettingsHandlersContext missing');
  return ctx;
};

/** Work Alone / PAP-like: only personal team exists — redirect to team home instead of picker */
export const SwitchTeamsGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ctx = React.useContext(TeamContext);
  const { personalTeam } = ctx.state;
  const isPapLike = useIsPapLike();

  React.useEffect(() => {
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

  return <>{children}</>;
};

const MainTeamsLayout: React.FC = () => {
  const { openSettingsForTeam, openSettingsForPersonal } =
    useSettingsHandlers();

  return (
    <>
      <Box
        id="TeamsScreen"
        sx={{
          px: 2,
          pb: 4,
          maxWidth: 500,
          mx: 'auto',
        }}
      >
        <Stack spacing={4}>
          <PersonalSection onOpenSettings={openSettingsForPersonal} />
          <TeamsSection onOpenSettings={openSettingsForTeam} />
        </Stack>
      </Box>
      <FloatingActions />
    </>
  );
};

export const SwitchTeams: React.FC = () => {
  return (
    <TeamProvider>
      <AppLayout>
        <SwitchTeamsGuard>
          <SettingsProvider>
            <MainTeamsLayout />
          </SettingsProvider>
        </SwitchTeamsGuard>
      </AppLayout>
    </TeamProvider>
  );
};

/** Same UI as the route without the PAP-like redirect; CT uses empty orbit data so `teams` stays []. */
export const SwitchTeamsUnguarded: React.FC = () => {
  return (
    <TeamProvider>
      <AppLayout>
        <SettingsProvider>
          <MainTeamsLayout />
        </SettingsProvider>
      </AppLayout>
    </TeamProvider>
  );
};

export default SwitchTeams;
