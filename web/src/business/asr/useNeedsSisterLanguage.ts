import { useContext, useEffect, useRef, useState } from 'react';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { logError, Severity } from '../../utils/logErrorService';
import { toError } from '../../utils/toError';
import { cachedNeedsSisterLanguage, needsSisterLanguage } from './asrLanguages';

interface Options {
  /** False skips the check (e.g. a Work Alone Offline session). */
  enabled?: boolean;
  /** Called once when the check fails, after the error is logged. */
  onFailed?: () => void;
}

/**
 * Whether the speech service needs a sister language to transcribe `bcp47`.
 * A language already checked this session answers at once; otherwise
 * `needsSister` is undefined until the service answers, and stays so without
 * a token (offline). An answer for a language that has since changed is
 * ignored.
 */
export function useNeedsSisterLanguage(
  bcp47: string,
  { enabled = true, onFailed }: Options = {}
) {
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const [result, setResult] = useState<{
    forBcp47: string;
    needsSister?: boolean;
    failed?: boolean;
  }>();
  // Callers pass a new function each render; only the latest is called.
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  const cached =
    enabled && token ? cachedNeedsSisterLanguage(bcp47) : undefined;

  useEffect(() => {
    if (!enabled || !token || cached !== undefined) return;
    let cancelled = false;
    needsSisterLanguage(bcp47, token)
      .then((needed) => {
        if (!cancelled) setResult({ forBcp47: bcp47, needsSister: needed });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
        setResult({ forBcp47: bcp47, failed: true });
        onFailedRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [bcp47, enabled, token, cached, errorReporter]);

  const current = result?.forBcp47 === bcp47 ? result : undefined;
  return {
    needsSister: cached ?? current?.needsSister,
    failed: cached === undefined && current?.failed === true,
  };
}
