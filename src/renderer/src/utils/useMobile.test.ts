import { renderHook, waitFor } from '@testing-library/react';
import { useMobile } from './useMobile';
import { LocalKey, localUserKey } from './localUserKey';

const mockUseMediaQuery = jest.fn();
const mockUseTheme = jest.fn();

jest.mock('@mui/material', () => ({
  ...(jest.requireActual('@mui/material') as object),
  useMediaQuery: (...args: unknown[]) => mockUseMediaQuery(...args),
  useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));

let mobileViewState = false;
const setMobileView = jest.fn((value: boolean) => {
  mobileViewState = value;
});

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'mobileView') return [mobileViewState, setMobileView];
    return [undefined, jest.fn()];
  }),
}));

describe('useMobile', () => {
  beforeEach(() => {
    mobileViewState = false;
    setMobileView.mockClear();
    mockUseMediaQuery.mockReset();
    mockUseTheme.mockReset();
    localStorage.clear();
    localStorage.setItem(LocalKey.userId, 'user-1');
    mockUseTheme.mockReturnValue({
      breakpoints: {
        down: () => 'sm',
      },
    });
  });

  it('syncs mobileView from localStorage when different', async () => {
    localStorage.setItem(localUserKey(LocalKey.mobileView), 'true');
    mockUseMediaQuery.mockReturnValue(false);

    renderHook(() => useMobile());

    await waitFor(() => {
      expect(setMobileView).toHaveBeenCalledWith(true);
    });
  });

  it('returns isMobile when width is mobile', () => {
    mockUseMediaQuery.mockReturnValue(true);

    const { result } = renderHook(() => useMobile());

    expect(result.current.isMobileWidth).toBe(true);
    expect(result.current.isMobileView).toBe(false);
    expect(result.current.isMobile).toBe(true);
  });

  it('returns isMobile when user toggles mobile view', () => {
    mobileViewState = true;
    mockUseMediaQuery.mockReturnValue(false);

    const { result } = renderHook(() => useMobile());

    expect(result.current.isMobileWidth).toBe(false);
    expect(result.current.isMobileView).toBe(true);
    expect(result.current.isMobile).toBe(true);
  });
});
