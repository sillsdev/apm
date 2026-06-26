import { createTheme } from '@mui/material';
import { getDataGridLocale } from './utils/dataGridLocale';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
    };
  }
}

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
          racetrackCurrent: '#111',
          racetrackComplete: '#888',
          racetrackIncomplete: '#ccc',
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
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              borderRadius: '8px',
              padding: '8px 16px',
              boxShadow: '1px 1px 3px #0000001F',
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
                background: '#333333',
                color: '#FFFFFF',
                '&:hover': {
                  background: '#555555',
                },
                '&:disabled': {
                  background: '#F0F0F0',
                },
              },
            },
          ],
        },
      },
    },
    getDataGridLocale(lang)
  );
