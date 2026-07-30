import { createTheme } from '@mui/material';
import { getDataGridLocale } from './utils/dataGridLocale';

// MUI has no `variant` on IconButton. Adding it to IconButtonOwnProps lets us
// pass `variant` in JSX; IconButton spreads props into its ownerState, so the
// MuiIconButton `variants` matcher below can style each variant. (The prop also
// lands as a harmless stray attribute on the underlying <button>.)
declare module '@mui/material/IconButton' {
  interface IconButtonOwnProps {
    variant?: 'floating' | 'primary' | 'outlined';
  }
}

// MUI Table also has no `variant` prop. As with IconButton above, Table includes
// arbitrary props in ownerState, allowing the MuiTable variant matcher to use
// this value. It is also forwarded to the underlying <table>.
declare module '@mui/material/Table' {
  interface TableOwnProps {
    variant?: 'striped';
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
      /** Fill for the "contained" action look (dark). */
      containedBg: string;
      /** Hover fill for the "contained" action look. */
      containedHoverBg: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
      containedBg: string;
      containedHoverBg: string;
    };
  }
}

// For the "contained" action look, shared by the
// MuiButton contained variant and any component that mimics it (see the
// palette `custom.containedBg`/`containedHoverBg` tokens below).
const CONTAINED_BG = '#333333';
const CONTAINED_HOVER_BG = '#555555';
const CONTAINED_DISABLED_BG = '#F0F0F0';

// The subtle drop shadow every themed button carries (see MuiButton root
// below). Exported so components that need to hand-roll a button
//  can reuse the exact same value.
export const BUTTON_SHADOW = '1px 1px 3px #0000001F';

export const createAppTheme = (lang: string) =>
  createTheme(
    {
      palette: {
        primary: {
          main: '#135CB9',
        },
        secondary: {
          main: '#00A7E1',
        },
        custom: {
          currentRegion: '#66FF0080',
          headerBackground: '#EEEEEE',
          racetrackCurrent: '#333',
          racetrackComplete: '#a8a8a8',
          racetrackIncomplete: '#e0e0e0',
          containedBg: CONTAINED_BG,
          containedHoverBg: CONTAINED_HOVER_BG,
        },
      },
      typography: {
        button: {
          textTransform: 'none',
        },
      },
      components: {
        MuiAppBar: {
          styleOverrides: {
            root: {
              boxShadow: 'none',
            },
          },
        },
        MuiTable: {
          variants: [
            {
              props: { variant: 'striped' },
              style: ({ theme }) => ({
                '& > tbody > tr:nth-of-type(even)': {
                  backgroundColor: theme.palette.action.hover,
                },
              }),
            },
          ],
        },
        MuiIconButton: {
          variants: [
            {
              // Contained "primary action" look, mirroring the MuiButton
              // contained variant. Filled only while enabled — the disabled
              // state resets to the plain default so the enabled button draws
              // attention on its own.
              props: { variant: 'primary' },
              style: {
                backgroundColor: CONTAINED_BG,
                color: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: BUTTON_SHADOW,
                '&:hover': {
                  backgroundColor: CONTAINED_HOVER_BG,
                },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: 'rgba(0, 0, 0, 0.26)',
                  boxShadow: 'none',
                },
              },
            },
            {
              // Soft edge to contrast against white, like MuiButton outlined.
              props: { variant: 'outlined' },
              style: {
                border: '1px solid #0000001F',
              },
            },
            {
              props: { variant: 'floating' },
              style: {
                // TODO
              },
            },
          ],
        },
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              borderRadius: '8px',
              padding: '8px 16px',
              boxShadow: BUTTON_SHADOW,
              color: '#000000',
              height: 36,
              background: '#FFFFFF',
              '&:hover': {
                background: '#E2E2E2',
              },
              '&:disabled': {
                background: '#F0F0F0',
              },
            },
          },
          variants: [
            {
              // Outlined buttons get a soft edge to contrast against white
              props: { variant: 'outlined' },
              style: {
                border: '1px solid #0000001F',
              },
            },
            {
              // Contained buttons are primary buttons
              props: { variant: 'contained' },
              style: {
                background: CONTAINED_BG,
                color: '#FFFFFF',
                '&:hover': {
                  background: CONTAINED_HOVER_BG,
                },
                '&:disabled': {
                  background: CONTAINED_DISABLED_BG,
                },
              },
            },
          ],
        },
      },
    },
    getDataGridLocale(lang)
  );
