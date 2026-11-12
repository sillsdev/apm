import { useRef, useLayoutEffect, useMemo } from 'react';
import { ReactIsInDevelomentMode } from './ReactIsInDevelopmentMode';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useMounted = (title?: string): (() => boolean) => {
  const mounted = useRef(0);

  const isDev = useMemo(() => ReactIsInDevelomentMode(), []);

  const isMounted = (): boolean => {
    return mounted.current > (isDev ? 1 : 0);
  };
  useLayoutEffect(() => {
    mounted.current += 1;
    return () => {
      if (!isDev || mounted.current > 1) {
        mounted.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isMounted;
};
