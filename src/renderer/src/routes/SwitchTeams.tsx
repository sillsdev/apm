import React from 'react';
import { RecordIdentity } from '@orbit/records';
import {
  Box,
  Card,
  Stack,
  Typography,
  Button,
  FormControlLabel,
  TextField,
  IconButton,
} from '@mui/material';
import { DialogMode } from '../model';
import TeamDialog, { ITeamDialog } from '../components/Team/TeamDialog';
import { useGlobal } from '../context/useGlobal';
import { useRole } from '../crud';
import { TokenContext } from '../context/TokenProvider';
import { useSnackBar } from '../hoc/SnackBar';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import ImportTab from '../components/ImportTab';
import { isElectron } from '../../api-variable';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import AppHead from '../components/App/AppHead';
import { useTheme, alpha } from '@mui/material/styles';
import { useMyNavigate } from '../utils/useMyNavigate';
import { TeamProvider } from '../context/TeamContext';
import { TeamContext } from '../context/TeamContext';
import { validateEmail } from '../utils/validateEmail';
import { axiosPost } from '../utils/axios';
import { LocalKey, localUserKey } from '../utils';

interface ISettingsButtonProps {
  label: string;
  onOpenSettings: () => void;
}

const SettingsButton = ({ label, onOpenSettings }: ISettingsButtonProps) => {
  const theme = useTheme();
  const bgColor = theme.palette.primary.light;
  const contrastColor = theme.palette.getContrastText(bgColor);

  return (
    <IconButton
      size="small"
      aria-label={label + ' settings'}
      onClick={(e) => {
        e.stopPropagation();
        onOpenSettings();
      }}
      sx={(theme) => ({
        color: theme.palette.primary.light,
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
        <SettingsButton label={label} onOpenSettings={onOpenSettings} />
      </Box>
    </Card>
  );
};

interface IPersonalSectionProps {
  onOpenSettings: () => void;
}
const PersonalSection = ({ onOpenSettings }: IPersonalSectionProps) => {
  const ctx = React.useContext(TeamContext);
  const { cardStrings, personalTeam } = ctx.state;

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
  const { teams, cardStrings } = ctx.state;

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

// Floating actions cluster: Add Team, Import (offline), Shared Content Creator, Error (developer)
const FloatingActions = () => {
  const ctx = React.useContext(TeamContext);
  const { teamCreate, isDeleting, cardStrings, sharedStrings } = ctx.state;
  const [, setBusy] = useGlobal('remoteBusy');
  const [offline] = useGlobal('offline');
  const [isDeveloper] = useGlobal('developer');
  const { userIsSharedContentAdmin } = useRole();
  const tokenctx = React.useContext(TokenContext).state;
  const { showMessage } = useSnackBar();
  const navigate = useMyNavigate();

  // Dialog states
  const [openAdd, setOpenAdd] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [openContent, setOpenContent] = React.useState(false);

  // Shared content creator state
  const [email, setEmail] = React.useState('');
  const [validEmail, setValidEmail] = React.useState(false);
  const [contentStatus, setContentStatus] = React.useState('');

  const t = cardStrings; // localization strings from context
  const ts = sharedStrings;

  const handleAddClick = () => setOpenAdd(true);
  const handleImportClick = () => setImportOpen(true);
  const handleContentClick = () => setOpenContent(true);
  const handleAdded = () => setOpenAdd(false);
  const handleContentDone = () => {
    setContentStatus('');
    setEmail('');
    setOpenContent(false);
  };

  const handleAddCommit = (
    value: ITeamDialog,
    cb?: (id: string) => Promise<void>
  ) => {
    setBusy(true); // reset via DataChanges
    teamCreate(value.team, value.process ?? '', async (id: string) => {
      cb && (await cb(id));
      setOpenAdd(false);
    });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setEmail(value);
    setValidEmail(validateEmail(value));
  };

  const handleSharedContentClick = () => {
    if (!validEmail) return;
    setValidEmail(false);
    setContentStatus(ts.saving);
    axiosPost(
      `users/sharedcreator/${encodeURIComponent(email)}/true`,
      null,
      tokenctx.accessToken || undefined
    )
      .then(() => {
        showMessage(t.creatorOK);
        handleContentDone();
      })
      .catch((err) => {
        // errStatus helper exists in store/AxiosStatus; import would bloat this screen; fallback to message
        setContentStatus(err?.message || 'Error');
      });
  };

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
          <Button
            id="TeamActAdd"
            data-testid="add-team-button"
            variant="outlined"
            onClick={handleAddClick}
            sx={(theme) => ({
              minWidth: 160,
              bgcolor: theme.palette.common.white,
            })}
          >
            {t.addNewTeam || 'Add New Team...'}
          </Button>
          {offline && (
            <Button
              id="teamActImport"
              variant="outlined"
              onClick={handleImportClick}
              sx={(theme) => ({
                minWidth: 110,
                bgcolor: theme.palette.common.white,
              })}
            >
              {t.import}
            </Button>
          )}
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

      {/* Add Team Dialog */}
      <TeamDialog
        mode={DialogMode.add}
        isOpen={openAdd}
        onOpen={handleAdded}
        onCommit={handleAddCommit}
        disabled={isDeleting}
      />

      {/* Shared Content Creator Dialog */}
      <BigDialog
        isOpen={openContent}
        onOpen={handleContentDone}
        onSave={validEmail ? handleSharedContentClick : undefined}
        onCancel={handleContentDone}
        title={t.creatorAdd}
        bp={BigDialogBp.mobile}
      >
        <FormControlLabel
          control={
            <TextField
              id="email"
              label={t.creatorEmail}
              value={email}
              onChange={handleEmailChange}
              margin="normal"
              required
              variant="filled"
              fullWidth
            />
          }
          label={contentStatus}
          labelPlacement="bottom"
        />
      </BigDialog>

      {/* Import Dialog (Electron only) */}
      {isElectron && importOpen && (
        <ImportTab isOpen={importOpen} onOpen={setImportOpen} />
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

export const SwitchTeams: React.FC = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <TeamProvider>
        <>
          <AppHead />
          <SettingsProvider>
            <MainTeamsLayout />
          </SettingsProvider>
        </>
      </TeamProvider>
    </Box>
  );
};

const MainTeamsLayout: React.FC = () => {
  const { openSettingsForTeam, openSettingsForPersonal } =
    useSettingsHandlers();

  return (
    <>
      <Box
        id="TeamsScreen"
        sx={{
          paddingTop: '80px',
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

export default SwitchTeams;
