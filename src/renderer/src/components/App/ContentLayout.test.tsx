import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ContentLayout from './ContentLayout';

// TT-7708: ContentLayout header reads theme.layout.gap; bare theme must not crash.
const bareTheme = createTheme();

test('ContentLayout renders under a theme without layout', () => {
  expect(bareTheme.layout).toBeUndefined();

  expect(() =>
    render(
      <ThemeProvider theme={bareTheme}>
        <ContentLayout header={<div>Header</div>}>
          <div>Body</div>
        </ContentLayout>
      </ThemeProvider>
    )
  ).not.toThrow();

  expect(screen.getByText('Header')).toBeInTheDocument();
  expect(screen.getByText('Body')).toBeInTheDocument();
});
