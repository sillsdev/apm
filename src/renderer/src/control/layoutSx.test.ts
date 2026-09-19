import '@testing-library/jest-dom';
import { createTheme } from '@mui/material/styles';
import { LAYOUT_GAP, layoutGap } from '../theme';
import { columnSx, rowSx, spreadSx } from './layoutSx';

// TT-7708: default MUI theme has no custom `layout`; card-ui plan chrome
// must not throw TypeError reading 'gap'.
const bareTheme = createTheme();

test('bare createTheme has no layout (QA repro precondition)', () => {
  expect(bareTheme.layout).toBeUndefined();
});

test('layoutGap falls back to LAYOUT_GAP when theme.layout is missing', () => {
  expect(layoutGap(bareTheme)).toBe(LAYOUT_GAP);
});

test('rowSx does not throw when theme.layout is undefined', () => {
  expect(() => rowSx(bareTheme)).not.toThrow();
  expect(rowSx(bareTheme).gap).toBe(LAYOUT_GAP);
});

test('columnSx does not throw when theme.layout is undefined', () => {
  expect(() => columnSx(bareTheme)).not.toThrow();
  expect(columnSx(bareTheme).gap).toBe(LAYOUT_GAP);
});

test('spreadSx does not throw when theme.layout is undefined', () => {
  expect(() => spreadSx(bareTheme)).not.toThrow();
  expect(spreadSx(bareTheme).gap).toBe(LAYOUT_GAP);
});
