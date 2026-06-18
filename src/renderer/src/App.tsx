import { ThemeProvider, createTheme } from '@mui/material';
import DataChanges from './hoc/DataChanges';
import { UnsavedProvider } from './context/UnsavedContext';
import SnackBarProvider from './hoc/SnackBar';
import { HotKeyProvider } from './context/HotKeyContext';
import routes from './routes/NavRoutes';
import { useSelector, shallowEqual } from 'react-redux';
import { IState } from './model';
import { getDataGridLocale } from './utils/dataGridLocale';
import { useMemo } from 'react';
export { HeadHeight } from './layout';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      currentRegion: string;
      headerBackground: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      currentRegion: string;
      headerBackground: string;
    };
  }
}

function App(): React.JSX.Element {
  const lang = useSelector((state: IState) => state.strings.lang, shallowEqual);

  const theme = useMemo(
    () =>
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
                  boxShadow: '1px 1px 3px rgba(0, 0, 0, 0.12)',
                  color: 'black',
                  height: 36,
                  background: '#fff',
                  '&:hover': {
                    background: '#e2e2e2',
                  },
                  '&:disabled': {
                    background: '#f0f0f0',
                  },
                },
              },
              variants: [
                {
                  // Contained buttons are primary buttons
                  props: { variant: 'contained' },
                  style: {
                    background: '#333',
                    color: '#fff',
                    '&:hover': {
                      background: '#555',
                    },
                    '&:disabled': {
                      background: '#f0f0f0',
                    },
                  },
                },
              ],
            },
          },
        },
        getDataGridLocale(lang)
      ),
    [lang]
  );

  return (
    <UnsavedProvider>
      <DataChanges>
        <SnackBarProvider>
          <HotKeyProvider>
            <ThemeProvider theme={theme}>{routes}</ThemeProvider>
          </HotKeyProvider>
        </SnackBarProvider>
      </DataChanges>
    </UnsavedProvider>
  );
}

export default App;
