import { useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import { getFingerprintArray } from '../utils';

/** Fingerprint is non-critical for first paint; load after mount. */
export function BootstrapFingerprint() {
  const [, setFingerprint] = useGlobal('fingerprint');

  useEffect(() => {
    let cancelled = false;
    getFingerprintArray()
      .then(([fp]) => {
        if (!cancelled && fp) setFingerprint(fp);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setFingerprint]);

  return null;
}
