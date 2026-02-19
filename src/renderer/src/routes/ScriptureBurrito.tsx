import {
  Avatar,
  Box,
  LinearProgress,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import StickyRedirect from '../components/StickyRedirect';
import { useLocation, useParams } from 'react-router-dom';
import Check from '@mui/icons-material/Check';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { BurritoHeader } from '../components/BurritoHeader';
import { AltButton, PriButton } from '../control';
import { useCreateBurrito } from '../burrito/useCreateBurrito';
import { useSnackBar } from '../hoc/SnackBar';
import { shallowEqual, useSelector } from 'react-redux';
import { burritoSelector, sharedSelector } from '../selector';
import { IBurritoStrings, ISharedStrings } from '@model/index';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

const setup = ['Books', 'Contents', 'Wrapper' /* 'Version', 'Format' */];

export function ScriptureBurrito() {
  const { pathname } = useLocation();
  const { teamId } = useParams();
  const [view, setView] = React.useState('');
  const [completed, setCompleted] = React.useState<number[]>([]);
  const [allowOpen, setAllowOpen] = React.useState(false);
  const { getOrgDefault } = useOrgDefaults();
  const { showMessage } = useSnackBar();
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const {
    createBurrito,
    progress,
    isCreating,
    error,
    result,
    resultReset,
    cancel,
    getResultPath,
  } = useCreateBurrito(teamId || '');

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const index = setup.indexOf(event.currentTarget.textContent?.trim() || '');
    if (index !== -1) {
      setCompleted((prev) => [...prev, index]);
      setView(`/burrito/${teamId}/${setup[index].toLowerCase()}`);
    }
  };

  const ready = () =>
    completed.includes(0) && completed.includes(1) && completed.includes(2);

  React.useEffect(() => {
    const newCompleted: number[] = [];
    setup.forEach((item, index) => {
      const value = getOrgDefault(`burrito${item}`, teamId);
      if (value) {
        newCompleted.push(index);
      }
    });
    setCompleted(newCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  React.useEffect(() => {
    getResultPath().then((path) => {
      ipc?.exists(path).then((exists) => {
        if (exists) {
          setAllowOpen(true);
        }
      });
    });
  }, [getResultPath]);

  React.useEffect(() => {
    if (result === 'success') {
      showMessage(t.success);
      resultReset();
      setAllowOpen(true);
    }
  }, [result, showMessage, resultReset, t.success]);

  const handleCreateBurrito = async () => {
    try {
      await createBurrito();
    } catch {
      // Error already displayed via hook state
    }
  };

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return (
    <BurritoHeader setView={setView} teamId={teamId}>
      <Stack direction="column" spacing={2} alignItems="center">
        <List sx={{ pt: 3 }}>
          {setup.map((item, index) => (
            <ListItemButton key={index} onClick={handleClick}>
              <ListItemAvatar>
                <Avatar>{completed.includes(index) ? <Check /> : ' '}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={item} />
            </ListItemButton>
          ))}
        </List>

        {isCreating && (
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            {progress ? (
              <>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {progress.phase} ({progress.bookIndex}/{progress.booksInPart}{' '}
                  books)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress.overallProgress}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress.partProgress}
                    sx={{ flex: 1 }}
                    color="secondary"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {progress.currentBook}
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t.preparing}
                </Typography>
                <LinearProgress variant="indeterminate" sx={{ mb: 1 }} />
              </>
            )}
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          {isCreating && (
            <AltButton onClick={cancel} aria-label="Cancel burrito creation">
              {ts.cancel}
            </AltButton>
          )}
          <PriButton
            onClick={handleCreateBurrito}
            disabled={!ready() || isCreating}
          >
            {t.create}
          </PriButton>
          {allowOpen && (
            <PriButton
              onClick={() =>
                getResultPath().then((path) => ipc?.openPath(path))
              }
            >
              {t.open}
            </PriButton>
          )}
        </Stack>
      </Stack>
    </BurritoHeader>
  );
}
