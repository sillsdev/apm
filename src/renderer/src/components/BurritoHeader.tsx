import { Box, Stack, Typography } from '@mui/material';
import AppHead from './App/AppHead';
import { TeamProvider } from '../context/TeamContext';
import { AltButton } from '../control/AltButton';
import { GrowingSpacer } from '../control/GrowingSpacer';
import { PriButton } from '../control/PriButton';

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
              <AltButton onClick={() => setView('/team')}>Teams</AltButton>
              {onSave && (
                <AltButton onClick={() => setView(`/burrito/${teamId}`)}>
                  Back
                </AltButton>
              )}
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
                <PriButton onClick={onSave} disabled={saveDisabled}>
                  Save
                </PriButton>
              </Stack>
            )}
          </Stack>
        </Box>
      </TeamProvider>
    </Box>
  );
}
