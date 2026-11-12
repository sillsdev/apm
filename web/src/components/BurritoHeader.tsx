import { Box, Stack, Typography } from '@mui/material';
import AppHead from './App/AppHead';
import { TeamProvider } from '../context/TeamContext';
import { Button, GrowingSpacer, rowSx } from '../control';

interface BurritoHeaderProps {
  children: React.ReactNode;
  burritoType?: string;
  teamId?: string;
  setView: (view: string) => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  action?: React.ReactNode;
}

export function BurritoHeader({
  children,
  setView,
  burritoType,
  teamId,
  onSave,
  saveDisabled = false,
  action,
}: BurritoHeaderProps) {
  return (
    <Box sx={{ width: '100%' }}>
      <AppHead />
      <TeamProvider>
        <Box id="BurritoScreen" sx={{ display: 'flex', paddingTop: '80px' }}>
          <Stack direction="column" sx={{ width: '100%' }}>
            <Stack direction="row">
              <Box sx={rowSx}>
                <Button onClick={() => setView('/team')}>Teams</Button>
                {onSave && (
                  <Button onClick={() => setView(`/burrito/${teamId}`)}>
                    Back
                  </Button>
                )}
              </Box>
              <GrowingSpacer />
              <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
                {`Scripture Burrito ${burritoType ? `- ${burritoType}` : ''}`}
              </Typography>
              <GrowingSpacer />
            </Stack>
            <Stack spacing={5} sx={{ p: 5, margin: 'auto' }}>
              {children}
            </Stack>
            {onSave && (
              <Stack justifyContent={'center'} sx={{ pt: 2, margin: 'auto' }}>
                {action}
                <Button
                  color="primary"
                  disabled={saveDisabled}
                  onClick={onSave}
                >
                  Save
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>
      </TeamProvider>
    </Box>
  );
}
