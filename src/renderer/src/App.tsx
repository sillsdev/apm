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
export const HeadHeight = 64;

function App(): JSX.Element {
  const lang = useSelector((state: IState) => state.strings.lang, shallowEqual);

  const theme = useMemo(
    () =>
      createTheme(
        {
          palette: {
            common: {
              white: '#ffffff',
            },
            // adding this background color change the plan sheet row background color to dark gray
            // background: {
            //   default: '#303030ff',
            // },
            primary: {
              main: '#135CB9', //Original: 135CB9, Better color: 1D9F90
            },
            secondary: {
              main: '#00A7E1', //Original: 00A7E1, Better color: 25CBB8
            },
            // Custom colors - simple key-value pairs
            custom: {
              currentRegion: 'rgb(102, 255, 0, .5)',
            },
          } as any,
          typography: {
            button: {
              textTransform: 'capitalize',
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
