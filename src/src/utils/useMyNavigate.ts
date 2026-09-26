import { NavigateOptions, To, useNavigate } from 'react-router-dom';
import { useHome } from './useHome';
import { useEffect, useState } from 'react';

const cancelListeners = new Set<() => void>();

/* A navigation issued through useMyNavigate was blocked and the user chose to stay. */
export const navigationCancelled = (): void => {
  cancelListeners.forEach((cb) => cb());
};

export const useMyNavigate = (): typeof myNavigate => {
  const navigate = useNavigate();
  const { checkHome } = useHome();
  const [goTo, setGoTo] = useState<{
    to: To;
    options: NavigateOptions | undefined;
  }>();

  useEffect(() => {
    if (goTo) navigate(goTo.to, goTo.options);
  }, [goTo]);

  useEffect(() => {
    const clear = () => setGoTo(undefined);
    cancelListeners.add(clear);
    return () => {
      cancelListeners.delete(clear);
    };
  }, []);

  function myNavigate(to: To, options?: NavigateOptions): void {
    checkHome(to);
    if (to !== goTo?.to) setGoTo({ to, options });
  }
  return myNavigate;
};
