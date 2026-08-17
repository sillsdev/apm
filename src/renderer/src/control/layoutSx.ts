import { Theme } from '@mui/material';

export const rowSx = (theme: Theme) => ({
  display: 'flex',
  gap: theme.layout.gap,
  minWidth: 0,
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
