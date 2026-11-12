import { useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import { getFingerprintArray, infoMsg, logError, Severity } from '../utils';
import bugsnagClient from '../auth/bugsnagClient';

/** Fingerprint is non-critical for first paint; load after mount. */
export function BootstrapFingerprint() {
  const [, setFingerprint] = useGlobal('fingerprint');

  useEffect(() => {
    let cancelled = false;
    getFingerprintArray()
      .then(([fp]) => {
        if (!cancelled && fp) setFingerprint(fp);
      })
      .catch((err) => {
        logError(
          Severity.info,
          bugsnagClient,
          infoMsg(err as Error, 'Fingerprint failed')
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
