import { createTheme } from '@mui/material';
import { ResponsiveStyleValue } from '@mui/system';
import { getDataGridLocale } from './utils/dataGridLocale';

declare module '@mui/material/IconButton' {
  interface IconButtonOwnProps {
    variant?: 'floating' | 'primary' | 'outlined';
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      black: string;
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      black: string;
      currentRegion: string;
      headerBackground: string;
      racetrackCurrent: string;
      racetrackComplete: string;
      racetrackIncomplete: string;
    };
  }
  interface Theme {
    layout: {
      gap: number;
      p: ResponsiveStyleValue<number>;
    };
  }
  interface ThemeOptions {
    layout?: {
      gap: number;
      p: ResponsiveStyleValue<number>;
    };
  }
}

export const LAYOUT_GAP = 1.5;
export const LAYOUT_P: ResponsiveStyleValue<number> = { xs: 1, sm: 1.5 };

const colors = {
  primary: '#135cb9',
  secondary: '#90a828',

  // Custom palette
  currentRegion: '#66ff0080',
  headerBackground: '#eeeeee',
  racetrackCurrent: '#333333',
  racetrackComplete: '#a8a8a8',
  racetrackIncomplete: '#e0e0e0',

  // Light buttons (text / outlined / contained secondary)
  lightBg: '#ffffff',
  lightBgRest: '#f6f8fa',
  lightBgHover: '#eff2f5',
  lightBgActive: '#e6eaef',
  lightText: '#25292e',
  lightBorder: '#d1d9e0',

  // Dark buttons (contained primary)
  darkBg: '#3d3d3d',
  darkBgHover: '#474747',
  darkBgActive: '#525252',
  darkText: '#f0f0f0',
  darkBorder: '#595959',

  // Disabled
  disabledText: '#818b98',
  disabledBorder: '#818b981a',

  shadow: '#1f23280a',
} as const;

const SUBTLE_SHADOW = `0 1px 0 0 ${colors.shadow}`;

// Lets a container change the color of the light buttons inside it
const LIGHT_BUTTON_BG_VAR = '--apm-light-button-bg';
// The container's color if it set one, otherwise the usual light button color
const LIGHT_BUTTON_BG = `var(${LIGHT_BUTTON_BG_VAR}, ${colors.lightBgRest})`;

// Grey background (header, etc.); buttons on it turn white so they stand out
export const tintedSurfaceSx = {
  backgroundColor: colors.headerBackground,
  [LIGHT_BUTTON_BG_VAR]: colors.lightBg,
};

export const createAppTheme = (lang: string) =>
  createTheme(
    {
      palette: {
        primary: {
          main: colors.primary,
        },
        secondary: {
          main: colors.secondary,
        },
        custom: {
          black: colors.darkBg,
          currentRegion: colors.currentRegion,
          headerBackground: colors.headerBackground,
          racetrackCurrent: colors.racetrackCurrent,
          racetrackComplete: colors.racetrackComplete,
          racetrackIncomplete: colors.racetrackIncomplete,
        },
      },
      layout: {
        gap: LAYOUT_GAP,
        p: LAYOUT_P,
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
            variant: 'contained',
            color: 'secondary',
          },
          styleOverrides: {
            root: {
              borderRadius: '8px',
            },
            sizeSmall: {
              padding: '4px 12px',
              height: 28,
            },
            sizeMedium: {
              padding: '8px 16px',
              height: 36,
            },
            sizeLarge: {
              padding: '10px 20px',
              height: 44,
            },
          },
          variants: [
            {
              props: { variant: 'text', color: 'primary' },
              style: {
                backgroundColor: colors.lightBg,
                color: colors.lightText,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                  boxShadow: SUBTLE_SHADOW,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                },
              },
            },
            {
              props: { variant: 'text', color: 'secondary' },
              style: {
                backgroundColor: colors.lightBg,
                color: colors.lightText,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                  boxShadow: SUBTLE_SHADOW,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                },
              },
            },
            {
              props: { variant: 'outlined', color: 'primary' },
              style: {
                backgroundColor: colors.lightBg,
                color: colors.lightText,
                border: '1px solid transparent',
                borderColor: colors.lightBorder,
                boxShadow: SUBTLE_SHADOW,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                  boxShadow: SUBTLE_SHADOW,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                },
              },
            },
            {
              props: { variant: 'outlined', color: 'secondary' },
              style: {
                backgroundColor: colors.lightBg,
                color: colors.lightText,
                border: '1px solid transparent',
                borderColor: colors.lightBorder,
                boxShadow: SUBTLE_SHADOW,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                  boxShadow: SUBTLE_SHADOW,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                },
              },
            },
            {
              props: { variant: 'contained' },
              style: {
                border: '1px solid transparent',
                '&.Mui-disabled': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.disabledText,
                  borderColor: colors.disabledBorder,
                  boxShadow: 'none',
                },
              },
            },
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                backgroundColor: colors.darkBg,
                color: colors.darkText,
                borderColor: colors.darkBorder,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: colors.darkBgHover,
                  color: colors.darkText,
                  borderColor: colors.darkBorder,
                  boxShadow: 'none',
                },
                '&:active': {
                  backgroundColor: colors.darkBgActive,
                  color: colors.darkText,
                  borderColor: colors.darkBorder,
                },
              },
            },
            {
              props: { variant: 'contained', color: 'secondary' },
              style: {
                backgroundColor: LIGHT_BUTTON_BG,
                color: colors.lightText,
                borderColor: colors.lightBorder,
                boxShadow: SUBTLE_SHADOW,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                  boxShadow: SUBTLE_SHADOW,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                  color: colors.lightText,
                  borderColor: colors.lightBorder,
                },
              },
            },
          ],
        },
        MuiIconButton: {
          variants: [
            {
              props: { variant: 'primary' },
              style: {
                backgroundColor: colors.darkBg,
                color: colors.darkText,
                border: '1px solid transparent',
                borderColor: colors.darkBorder,
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: colors.darkBgHover,
                  color: colors.darkText,
                  borderColor: colors.darkBorder,
                },
                '&:active': {
                  backgroundColor: colors.darkBgActive,
                  color: colors.darkText,
                  borderColor: colors.darkBorder,
                },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: colors.disabledText,
                  borderColor: 'transparent',
                },
              },
            },
            {
              props: { variant: 'outlined' },
              style: {
                border: `1px solid ${colors.lightBorder}`,
                borderRadius: '8px',
                boxShadow: SUBTLE_SHADOW,
                '&:hover': {
                  backgroundColor: colors.lightBgHover,
                },
                '&:active': {
                  backgroundColor: colors.lightBgActive,
                },
              },
            },
          ],
        },
      },
    },
    getDataGridLocale(lang)
  );
