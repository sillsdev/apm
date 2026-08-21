import { LAYOUT_GAP, LAYOUT_P } from '../theme';

export const rowSx = {
  display: 'flex',
  gap: LAYOUT_P,
  minWidth: 0,
};

export const columnSx = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: LAYOUT_GAP,
};

export const spreadSx = {
  ...rowSx,
  justifyContent: 'space-between',
  width: '100%',
};

// For flexible content (e.g., contains text that can truncate)
export const flexibleSx = { flex: '1 1 auto', minWidth: 0 };

// For rigid content (e.g., only contains icon buttons)
export const rigidSx = { flexShrink: 0 };
