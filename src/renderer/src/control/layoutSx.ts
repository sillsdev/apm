import { Theme } from '@mui/material';
import { layoutGap } from '../theme';

export const rowSx = (theme: Theme) => ({
  display: 'flex',
  gap: layoutGap(theme),
  minWidth: 0,
});

export const columnSx = (theme: Theme) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  gap: layoutGap(theme),
});

export const spreadSx = (theme: Theme) => ({
  ...rowSx(theme),
  justifyContent: 'space-between',
  width: '100%',
});

// For flexible content (e.g., contains text that can truncate)
export const flexibleSx = { flex: '1 1 auto', minWidth: 0 };

// For rigid content (e.g., only contains icon buttons)
export const rigidSx = { flexShrink: 0 };
