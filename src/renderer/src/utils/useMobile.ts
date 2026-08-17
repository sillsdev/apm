import { useEffect, useMemo } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { useGlobal } from '../context/useGlobal';
import { LocalKey, localUserKey } from './localUserKey';

interface UseMobileResult {
  isMobile: boolean;
  isMobileView: boolean;
  isMobileWidth: boolean;
}

export const useMobile = (): UseMobileResult => {
  const theme = useTheme();
  const isMobileWidth = useMediaQuery(theme.breakpoints.down('sm'));
  const [isMobileView, setMobileView] = useGlobal('mobileView');

  useEffect(() => {
    const stored = localStorage.getItem(localUserKey(LocalKey.mobileView));
    const storedValue = stored === 'true';
    if (storedValue !== isMobileView) setMobileView(storedValue);
  }, [isMobileView, setMobileView]);

  const isMobile = useMemo(
    () => isMobileView || isMobileWidth,
    [isMobileView, isMobileWidth]
  );

  return { isMobile, isMobileView, isMobileWidth };
};
